#include "qfblotter/MarketSim.hpp"

#include <algorithm>
#include <cmath>

namespace qfblotter {

MarketSim::MarketSim(unsigned int seed, double startPrice, double step)
    : rng_(seed), dist_(0.0, 1.0), startPrice_(startPrice), step_(step) {}

double MarketSim::mark(const std::string& symbol) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = state_.find(symbol);
    if (it == state_.end()) {
        state_[symbol] = State{startPrice_};
        return startPrice_;
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
        st.last = startPrice_;
    }
    st.last += dist_(rng_) * step_;
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
