#pragma once

#include <chrono>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

#include "qfblotter/Json.hpp"

namespace qfblotter {

struct OrderRecord {
    std::string clOrdId;
    std::string orderId;
    std::string symbol;
    char side{'0'};
    double price{0.0};
    int quantity{0};
    int leavesQty{0};
    int cumQty{0};
    double avgPx{0.0};
    std::string status;
    std::string rejectReason;
    std::string transactTime;
    
    // Performance metrics
    int64_t submitTimeUs{0};   // Microseconds since epoch when order received
    int64_t ackTimeUs{0};      // Microseconds when first ack sent
    int64_t fillTimeUs{0};     // Microseconds when fully filled
    int64_t latencyUs{0};      // Order → Ack latency in microseconds
};

// Aggregate statistics
struct OrderStats {
    int totalOrders{0};
    int newOrders{0};
    int partialOrders{0};
    int filledOrders{0};
    int rejectedOrders{0};
    int canceledOrders{0};
    int64_t avgLatencyUs{0};
    int64_t minLatencyUs{0};
    int64_t maxLatencyUs{0};
    int64_t p99LatencyUs{0};
    double totalNotional{0.0};
    double filledNotional{0.0};
};

class OrderStore {
public:
    void upsert(const OrderRecord& record);
    void updateStatus(const std::string& clOrdId, const std::string& status,
                      int leavesQty, int cumQty, double avgPx);
    void reject(const std::string& clOrdId, const std::string& reason);

    std::optional<OrderRecord> get(const std::string& clOrdId) const;
    bool exists(const std::string& clOrdId) const;
    
    // Get all orders that can still be filled (NEW or PARTIAL status)
    std::vector<OrderRecord> getOpenOrders() const;
    
    // Get aggregate statistics
    OrderStats getStats() const;

    Json snapshotJson() const;
    std::string snapshotString() const;

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::string, OrderRecord> orders_;
    std::vector<std::string> orderIndex_;
};

}  // namespace qfblotter
