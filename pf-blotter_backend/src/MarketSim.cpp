#include "qfblotter/MarketSim.hpp"

#include <algorithm>
#include <cmath>
#include <unordered_map>

namespace qfblotter {

namespace {
// Realistic starting prices for common tickers (approximate as of 2024)
const std::unordered_map<std::string, double> TICKER_PRICES = {
    {"AAPL", 185.00},   {"GOOGL", 175.00},  {"MSFT", 420.00},
    {"AMZN", 185.00},   {"NVDA", 875.00},   {"META", 500.00},
    {"TSLA", 175.00},   {"AMD", 155.00},    {"INTC", 42.00},
    {"NFLX", 625.00},   {"DIS", 115.00},    {"PYPL", 62.00},
    {"V", 280.00},      {"MA", 460.00},     {"JPM", 195.00},
    {"BAC", 35.00},     {"WFC", 55.00},     {"GS", 475.00},
    {"C", 60.00},       {"MS", 95.00},      {"IBM", 185.00},
    {"ORCL", 125.00},   {"CRM", 275.00},    {"ADBE", 575.00},
    {"UBER", 78.00},    {"LYFT", 15.00},    {"ABNB", 145.00},
    {"COIN", 225.00},   {"SQ", 75.00},      {"SHOP", 78.00},
    {"SNAP", 11.00},    {"TWTR", 45.00},    {"PINS", 32.00},
    {"SPY", 520.00},    {"QQQ", 440.00},    {"IWM", 210.00},
};

double getRealisticPrice(const std::string& symbol, double defaultPrice) {
    auto it = TICKER_PRICES.find(symbol);
    return (it != TICKER_PRICES.end()) ? it->second : defaultPrice;
}
}  // namespace

MarketSim::MarketSim(unsigned int seed, double startPrice, double step)
    : rng_(seed), dist_(0.0, 1.0), startPrice_(startPrice), step_(step) {}

double MarketSim::mark(const std::string& symbol) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = state_.find(symbol);
    if (it == state_.end()) {
        // Use realistic price if available, otherwise default
        double price = getRealisticPrice(symbol, startPrice_);
        state_[symbol] = State{price};
        return price;
    }
    return it->second.last;
}

double MarketSim::nextTick(const std::string& symbol) {
    std::lock_guard<std::mutex> lock(mutex_);
    return nextTickUnsafe(symbol);
}

// Internal helper - must be called with mutex held
double MarketSim::nextTickUnsafe(const std::string& symbol) {
    auto& st = state_[symbol];
    if (st.last == 0.0) {
        st.last = getRealisticPrice(symbol, startPrice_);
    }
    // Price movement proportional to current price (more realistic)
    double move = dist_(rng_) * step_ * (st.last / 100.0);
    st.last += move;
    if (st.last < 0.01) {
        st.last = 0.01;
    }
    return st.last;
}

bool MarketSim::shouldFill(const std::string& symbol, char side, double limitPx) {
    std::lock_guard<std::mutex> lock(mutex_);
    double px = nextTickUnsafe(symbol);
    if (side == '1') {  // Buy
        return px <= limitPx;
    }
    if (side == '2') {  // Sell
        return px >= limitPx;
    }
    return false;
}

FillResult MarketSim::attemptFill(const std::string& symbol, char side, double limitPx, int leavesQty) {
    std::lock_guard<std::mutex> lock(mutex_);
    FillResult result;
    
    if (leavesQty <= 0) {
        return result;  // Nothing to fill
    }
    
    double px = nextTickUnsafe(symbol);
    bool canFill = false;
    
    if (side == '1') {  // Buy - fill if market price <= limit
        canFill = px <= limitPx;
    } else if (side == '2') {  // Sell - fill if market price >= limit
        canFill = px >= limitPx;
    }
    
    if (!canFill) {
        return result;  // Price not favorable
    }
    
    // Determine fill quantity (partial or full)
    // Small orders (<= 100) fill completely, larger orders may partially fill
    if (leavesQty <= 100) {
        result.fillQty = leavesQty;
        result.complete = true;
    } else {
        // Random fill ratio between 20-100%
        double ratio = fillRatio_(rng_);
        result.fillQty = std::max(1, static_cast<int>(leavesQty * ratio));
    }
    
    result.fillQty = std::min(result.fillQty, leavesQty);
    result.fillPx = px;
    result.complete = (result.fillQty >= leavesQty);
    
    return result;
}

OrderBook MarketSim::getOrderBook(const std::string& symbol, int depth) {
    std::lock_guard<std::mutex> lock(mutex_);
    OrderBook book;
    book.symbol = symbol;
    
    // Get current mid price (without lock since we already hold it)
    auto it = state_.find(symbol);
    double mid = (it == state_.end()) ? startPrice_ : it->second.last;
    if (mid <= 0.01) {
        mid = startPrice_;
    }
    
    // Generate spread (0.01 to 0.05 of price)
    double spreadPct = 0.001 + (dist_(rng_) + 1.0) * 0.002;  // 0.1% to 0.5%
    double halfSpread = mid * spreadPct / 2.0;
    
    book.lastPrice = mid;
    book.spread = halfSpread * 2.0;
    
    // Generate bids (below mid, sorted high to low)
    double bidStart = mid - halfSpread;
    for (int i = 0; i < depth; ++i) {
        BookLevel level;
        level.price = std::round((bidStart - i * step_ * 2.0) * 100.0) / 100.0;
        level.quantity = qtyDist_(rng_);
        if (level.price > 0.0) {
            book.bids.push_back(level);
        }
    }
    
    // Generate asks (above mid, sorted low to high)
    double askStart = mid + halfSpread;
    for (int i = 0; i < depth; ++i) {
        BookLevel level;
        level.price = std::round((askStart + i * step_ * 2.0) * 100.0) / 100.0;
        level.quantity = qtyDist_(rng_);
        book.asks.push_back(level);
    }
    
    return book;
}

}  // namespace qfblotter
