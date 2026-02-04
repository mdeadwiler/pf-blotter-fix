#pragma once

#include <atomic>
#include <chrono>
#include <fstream>
#include <mutex>
#include <string>
#include <thread>
#include <functional>

#include "qfblotter/OrderStore.hpp"

namespace qfblotter {

// File-based persistence for order recovery
// Saves order state to JSON file periodically and on shutdown
class PersistenceManager {
public:
    using OrderLoader = std::function<void(const OrderRecord&)>;
    
    explicit PersistenceManager(const std::string& filePath, int saveIntervalSeconds = 5);
    ~PersistenceManager();
    
    // Start background save thread
    void start(const OrderStore& store);
    
    // Stop background thread and do final save
    void stop();
    
    // Load orders from file (call before start)
    // Returns number of orders loaded
    int load(OrderLoader loader);
    
    // Force immediate save
    void saveNow(const OrderStore& store);
    
    // Get statistics
    int getSaveCount() const { return saveCount_.load(); }
    int getLoadCount() const { return loadCount_; }
    std::string getLastSaveTime() const;
    
private:
    void backgroundSave(const OrderStore& store);
    void doSave(const OrderStore& store);
    
    std::string filePath_;
    int saveIntervalSeconds_;
    std::atomic<bool> running_{false};
    std::thread saveThread_;
    mutable std::mutex mutex_;
    std::atomic<int> saveCount_{0};
    int loadCount_{0};
    std::chrono::system_clock::time_point lastSaveTime_;
};

}  // namespace qfblotter
