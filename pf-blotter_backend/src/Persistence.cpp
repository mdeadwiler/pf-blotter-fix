#include "qfblotter/Persistence.hpp"

#include <filesystem>
#include <iomanip>
#include <iostream>
#include <sstream>

#include <nlohmann/json.hpp>

namespace qfblotter {

PersistenceManager::PersistenceManager(const std::string& filePath, int saveIntervalSeconds)
    : filePath_(filePath), saveIntervalSeconds_(saveIntervalSeconds) {
    // Ensure directory exists
    auto dir = std::filesystem::path(filePath_).parent_path();
    if (!dir.empty() && !std::filesystem::exists(dir)) {
        std::filesystem::create_directories(dir);
    }
}

PersistenceManager::~PersistenceManager() {
    stop();
}

void PersistenceManager::start(const OrderStore& store) {
    if (running_.exchange(true)) {
        return;  // Already running
    }
    
    saveThread_ = std::thread(&PersistenceManager::backgroundSave, this, std::cref(store));
}

void PersistenceManager::stop() {
    if (!running_.exchange(false)) {
        return;  // Not running
    }
    
    if (saveThread_.joinable()) {
        saveThread_.join();
    }
}

int PersistenceManager::load(OrderLoader loader) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (!std::filesystem::exists(filePath_)) {
        return 0;
    }
    
    try {
        std::ifstream file(filePath_);
        if (!file.is_open()) {
            return 0;
        }
        
        nlohmann::json j;
        file >> j;
        
        if (!j.contains("orders") || !j["orders"].is_array()) {
            return 0;
        }
        
        int count = 0;
        for (const auto& orderJson : j["orders"]) {
            OrderRecord record;
            record.clOrdId = orderJson.value("clOrdId", "");
            record.orderId = orderJson.value("orderId", "");
            record.symbol = orderJson.value("symbol", "");
            record.side = orderJson.value("side", "1")[0];
            record.price = orderJson.value("price", 0.0);
            record.quantity = orderJson.value("quantity", 0);
            record.leavesQty = orderJson.value("leavesQty", 0);
            record.cumQty = orderJson.value("cumQty", 0);
            record.avgPx = orderJson.value("avgPx", 0.0);
            record.status = orderJson.value("status", "NEW");
            record.rejectReason = orderJson.value("rejectReason", "");
            record.transactTime = orderJson.value("transactTime", "");
            record.submitTimeUs = orderJson.value("submitTimeUs", int64_t(0));
            record.ackTimeUs = orderJson.value("ackTimeUs", int64_t(0));
            record.fillTimeUs = orderJson.value("fillTimeUs", int64_t(0));
            record.latencyUs = orderJson.value("latencyUs", int64_t(0));
            
            if (!record.clOrdId.empty()) {
                loader(record);
                count++;
            }
        }
        
        loadCount_ = count;
        std::cout << "[PERSISTENCE] Loaded " << count << " orders from " << filePath_ << std::endl;
        return count;
    } catch (const std::exception& e) {
        std::cerr << "[PERSISTENCE] Error loading: " << e.what() << std::endl;
        return 0;
    }
}

void PersistenceManager::saveNow(const OrderStore& store) {
    doSave(store);
}

std::string PersistenceManager::getLastSaveTime() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (saveCount_ == 0) {
        return "never";
    }
    
    auto time = std::chrono::system_clock::to_time_t(lastSaveTime_);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time), "%H:%M:%S");
    return ss.str();
}

void PersistenceManager::backgroundSave(const OrderStore& store) {
    while (running_) {
        // Sleep in small increments to allow quick shutdown
        for (int i = 0; i < saveIntervalSeconds_ * 10 && running_; ++i) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        
        if (running_) {
            doSave(store);
        }
    }
    
    // Final save on shutdown
    doSave(store);
    std::cout << "[PERSISTENCE] Final save complete" << std::endl;
}

void PersistenceManager::doSave(const OrderStore& store) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    try {
        nlohmann::json j;
        j["version"] = 1;
        j["savedAt"] = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        
        auto snapshot = store.snapshotJson();
        j["orders"] = snapshot["orders"];
        
        // Write to temp file first, then rename (atomic)
        std::string tempPath = filePath_ + ".tmp";
        std::ofstream file(tempPath);
        if (!file.is_open()) {
            std::cerr << "[PERSISTENCE] Failed to open " << tempPath << std::endl;
            return;
        }
        
        file << j.dump(2);
        file.close();
        
        // Atomic rename
        std::filesystem::rename(tempPath, filePath_);
        
        lastSaveTime_ = std::chrono::system_clock::now();
        saveCount_++;
        
    } catch (const std::exception& e) {
        std::cerr << "[PERSISTENCE] Save error: " << e.what() << std::endl;
    }
}

}  // namespace qfblotter
