#pragma once

#include <mutex>
#include <random>
#include <string>
#include <unordered_map>
#include <vector>

namespace qfblotter {

// Result of a fill attempt
struct FillResult {
    int fillQty{0};      // Quantity filled (0 = no fill)
    double fillPx{0.0};  // Price at which fill occurred
    bool complete{false}; // True if order fully filled
};

// Single level in the order book
struct BookLevel {
    double price{0.0};
    int quantity{0};
};

// Simulated order book for a symbol
struct OrderBook {
    std::string symbol;
    std::vector<BookLevel> bids;  // Sorted high to low (best bid first)
    std::vector<BookLevel> asks;  // Sorted low to high (best ask first)
    double lastPrice{0.0};
    double spread{0.0};
};

class MarketSim {
public:
    explicit MarketSim(unsigned int seed = 42, double startPrice = 100.0, double step = 0.05);

    double mark(const std::string& symbol);
    double nextTick(const std::string& symbol);
    bool shouldFill(const std::string& symbol, char side, double limitPx);
    
    // Partial fill support - returns how much to fill
    FillResult attemptFill(const std::string& symbol, char side, double limitPx, int leavesQty);
    
    // Get simulated order book for a symbol
    OrderBook getOrderBook(const std::string& symbol, int depth = 5);

private:
    // Internal helper - must be called with mutex held
    double nextTickUnsafe(const std::string& symbol);
    struct State {
        double last{0.0};
    };

    mutable std::mutex mutex_;  // Thread safety for all operations
    std::mt19937 rng_;
    std::normal_distribution<double> dist_;
    std::uniform_real_distribution<double> fillRatio_{0.2, 1.0};  // Fill 20-100% of remaining
    std::uniform_int_distribution<int> qtyDist_{50, 500};  // Random qty for book levels
    double startPrice_;
    double step_;
    std::unordered_map<std::string, State> state_;
};

}  // namespace qfblotter
