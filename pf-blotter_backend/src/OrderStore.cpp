#include "qfblotter/OrderStore.hpp"

#include <algorithm>

namespace qfblotter {

void OrderStore::upsert(const OrderRecord& record) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = orders_.find(record.clOrdId);
    if (it == orders_.end()) {
        orders_.emplace(record.clOrdId, record);
        orderIndex_.push_back(record.clOrdId);
    } else {
        it->second = record;
    }
}

void OrderStore::updateStatus(const std::string& clOrdId, const std::string& status,
                              int leavesQty, int cumQty, double avgPx) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = orders_.find(clOrdId);
    if (it == orders_.end()) {
        return;
    }
    it->second.status = status;
    it->second.leavesQty = leavesQty;
    it->second.cumQty = cumQty;
    it->second.avgPx = avgPx;
}

void OrderStore::reject(const std::string& clOrdId, const std::string& reason) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = orders_.find(clOrdId);
    if (it == orders_.end()) {
        return;
    }
    it->second.status = "REJECTED";
    it->second.rejectReason = reason;
}

std::optional<OrderRecord> OrderStore::get(const std::string& clOrdId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = orders_.find(clOrdId);
    if (it == orders_.end()) {
        return std::nullopt;
    }
    return it->second;
}

bool OrderStore::exists(const std::string& clOrdId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return orders_.find(clOrdId) != orders_.end();
}

std::vector<OrderRecord> OrderStore::getOpenOrders() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<OrderRecord> result;
    for (const auto& [id, order] : orders_) {
        if (order.status == "NEW" || order.status == "PARTIAL") {
            result.push_back(order);
        }
    }
    return result;
}

OrderStats OrderStore::getStats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    OrderStats stats;
    
    std::vector<int64_t> latencies;
    latencies.reserve(orders_.size());
    
    for (const auto& [id, o] : orders_) {
        stats.totalOrders++;
        
        if (o.status == "NEW") stats.newOrders++;
        else if (o.status == "PARTIAL") stats.partialOrders++;
        else if (o.status == "FILLED") stats.filledOrders++;
        else if (o.status == "REJECTED") stats.rejectedOrders++;
        else if (o.status == "CANCELED") stats.canceledOrders++;
        
        // Notional calculations
        stats.totalNotional += o.price * o.quantity;
        if (o.status == "FILLED" || o.status == "PARTIAL") {
            stats.filledNotional += o.avgPx * o.cumQty;
        }
        
        // Latency tracking
        if (o.latencyUs > 0) {
            latencies.push_back(o.latencyUs);
        }
    }
    
    // Calculate latency statistics
    if (!latencies.empty()) {
        std::sort(latencies.begin(), latencies.end());
        
        int64_t sum = 0;
        for (auto l : latencies) sum += l;
        stats.avgLatencyUs = sum / static_cast<int64_t>(latencies.size());
        stats.minLatencyUs = latencies.front();
        stats.maxLatencyUs = latencies.back();
        
        // P99 latency
        size_t p99Idx = static_cast<size_t>(latencies.size() * 0.99);
        if (p99Idx >= latencies.size()) p99Idx = latencies.size() - 1;
        stats.p99LatencyUs = latencies[p99Idx];
    }
    
    return stats;
}

Json OrderStore::snapshotJson() const {
    std::lock_guard<std::mutex> lock(mutex_);
    Json root = Json::array();
    for (const auto& id : orderIndex_) {
        auto it = orders_.find(id);
        if (it == orders_.end()) {
            continue;
        }
        const auto& o = it->second;
        Json j;
        j["clOrdId"] = o.clOrdId;
        j["orderId"] = o.orderId;
        j["symbol"] = o.symbol;
        j["side"] = std::string(1, o.side);
        j["price"] = o.price;
        j["quantity"] = o.quantity;
        j["leavesQty"] = o.leavesQty;
        j["cumQty"] = o.cumQty;
        j["avgPx"] = o.avgPx;
        j["status"] = o.status;
        j["rejectReason"] = o.rejectReason;
        j["transactTime"] = o.transactTime;
        j["latencyUs"] = o.latencyUs;
        root.push_back(std::move(j));
    }
    return root;
}

std::string OrderStore::snapshotString() const {
    return dump(snapshotJson());
}

}  // namespace qfblotter
