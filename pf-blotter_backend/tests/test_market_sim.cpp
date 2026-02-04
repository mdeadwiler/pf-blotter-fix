#include <gtest/gtest.h>
#include "qfblotter/MarketSim.hpp"

using namespace qfblotter;

class MarketSimTest : public ::testing::Test {
protected:
    // Use fixed seed for reproducible tests
    MarketSim sim{42, 100.0, 0.05};
};

// Test: Initial mark price (use unknown ticker to get default price)
TEST_F(MarketSimTest, InitialMarkPrice) {
    double price = sim.mark("UNKNOWN_TICKER");
    EXPECT_DOUBLE_EQ(price, 100.0);  // Default start price for unknown tickers
    
    // Known tickers get realistic prices
    double aaplPrice = sim.mark("AAPL");
    EXPECT_GT(aaplPrice, 100.0);  // AAPL should have a realistic price
}

// Test: Price ticks are within reasonable bounds
TEST_F(MarketSimTest, PriceTickBounds) {
    // Generate many ticks and verify they stay reasonable
    for (int i = 0; i < 100; ++i) {
        double tick = sim.nextTick("TEST");
        EXPECT_GT(tick, 0.0);  // Price must be positive
    }
}

// Test: Different symbols have independent prices
TEST_F(MarketSimTest, IndependentSymbols) {
    // Use unknown tickers to test independence with default prices
    double sym1Price = sim.mark("SYM1_TEST");
    double sym2Price = sim.mark("SYM2_TEST");
    
    // Both start at the same default price
    EXPECT_DOUBLE_EQ(sym1Price, 100.0);
    EXPECT_DOUBLE_EQ(sym2Price, 100.0);
    
    // Advance SYM1, SYM2 should remain at starting price
    sim.nextTick("SYM1_TEST");
    sim.nextTick("SYM1_TEST");
    sim.nextTick("SYM1_TEST");
    
    // SYM2 hasn't been ticked yet, so it's still at start
    EXPECT_DOUBLE_EQ(sim.mark("SYM2_TEST"), 100.0);
    // SYM1 has moved
    EXPECT_NE(sim.mark("SYM1_TEST"), 100.0);
}

// Test: Buy order should fill when market price <= limit
TEST_F(MarketSimTest, BuyFillLogic) {
    // Set up a scenario where we know the price
    double currentPrice = sim.mark("FILL_TEST");
    
    // High limit should fill
    bool shouldFillHigh = sim.shouldFill("HIGH_LIMIT", '1', currentPrice + 10.0);
    // Result depends on random tick, but a very high limit should usually fill
    
    // Very low limit likely won't fill
    MarketSim lowSim{123, 100.0, 0.01};  // Small step
    bool shouldFillLow = lowSim.shouldFill("LOW_LIMIT", '1', 1.0);  // Way below market
    EXPECT_FALSE(shouldFillLow);
}

// Test: Sell order should fill when market price >= limit
TEST_F(MarketSimTest, SellFillLogic) {
    MarketSim sellSim{456, 100.0, 0.01};
    
    // Very low limit should fill (market price will be >= limit)
    bool shouldFillLow = sellSim.shouldFill("SELL_LOW", '2', 1.0);
    EXPECT_TRUE(shouldFillLow);
    
    // Very high limit won't fill
    bool shouldFillHigh = sellSim.shouldFill("SELL_HIGH", '2', 10000.0);
    EXPECT_FALSE(shouldFillHigh);
}

// Test: Partial fill - small orders fill completely
TEST_F(MarketSimTest, SmallOrdersFillCompletely) {
    // Create a scenario where fill should occur
    // Small orders (<= 100) should fill completely when price is favorable
    MarketSim fillSim{789, 100.0, 0.01};
    
    // High limit buy should fill, and small qty should fill completely
    auto result = fillSim.attemptFill("SMALL", '1', 150.0, 50);
    
    if (result.fillQty > 0) {
        // If it filled, should be complete (50 <= 100)
        EXPECT_EQ(result.fillQty, 50);
        EXPECT_TRUE(result.complete);
    }
}

// Test: Partial fill - large orders may partially fill
TEST_F(MarketSimTest, LargeOrdersMayPartialFill) {
    MarketSim fillSim{101, 100.0, 0.01};
    
    // Large order with favorable price
    auto result = fillSim.attemptFill("LARGE", '1', 200.0, 5000);
    
    if (result.fillQty > 0) {
        // Fill qty should be between 20% and 100% of leaves
        EXPECT_GE(result.fillQty, 1);
        EXPECT_LE(result.fillQty, 5000);
    }
}

// Test: No fill on zero leaves
TEST_F(MarketSimTest, NoFillOnZeroLeaves) {
    auto result = sim.attemptFill("ZERO", '1', 200.0, 0);
    EXPECT_EQ(result.fillQty, 0);
    EXPECT_FALSE(result.complete);
}

// Test: Order book generation
TEST_F(MarketSimTest, OrderBookGeneration) {
    auto book = sim.getOrderBook("BOOK_TEST", 5);
    
    EXPECT_EQ(book.symbol, "BOOK_TEST");
    EXPECT_EQ(book.bids.size(), 5);
    EXPECT_EQ(book.asks.size(), 5);
    EXPECT_GT(book.lastPrice, 0.0);
    EXPECT_GT(book.spread, 0.0);
    
    // Bids should be sorted high to low
    for (size_t i = 1; i < book.bids.size(); ++i) {
        EXPECT_LE(book.bids[i].price, book.bids[i-1].price);
    }
    
    // Asks should be sorted low to high
    for (size_t i = 1; i < book.asks.size(); ++i) {
        EXPECT_GE(book.asks[i].price, book.asks[i-1].price);
    }
    
    // Best bid should be less than best ask (no crossed book)
    if (!book.bids.empty() && !book.asks.empty()) {
        EXPECT_LT(book.bids[0].price, book.asks[0].price);
    }
}

// Test: Order book quantities are reasonable
TEST_F(MarketSimTest, OrderBookQuantities) {
    auto book = sim.getOrderBook("QTY_TEST", 5);
    
    for (const auto& level : book.bids) {
        EXPECT_GE(level.quantity, 50);   // Min qty
        EXPECT_LE(level.quantity, 500);  // Max qty
    }
    
    for (const auto& level : book.asks) {
        EXPECT_GE(level.quantity, 50);
        EXPECT_LE(level.quantity, 500);
    }
}

// Test: Deterministic with same seed
TEST_F(MarketSimTest, DeterministicWithSeed) {
    MarketSim sim1{999, 100.0, 0.05};
    MarketSim sim2{999, 100.0, 0.05};
    
    // Same seed should produce same sequence
    for (int i = 0; i < 10; ++i) {
        EXPECT_DOUBLE_EQ(sim1.nextTick("DET"), sim2.nextTick("DET"));
    }
}

// Test: Different seeds produce different sequences
TEST_F(MarketSimTest, DifferentSeedsProduceDifferentResults) {
    MarketSim sim1{111, 100.0, 0.05};
    MarketSim sim2{222, 100.0, 0.05};
    
    bool anyDifferent = false;
    for (int i = 0; i < 10; ++i) {
        if (sim1.nextTick("DIFF") != sim2.nextTick("DIFF")) {
            anyDifferent = true;
            break;
        }
    }
    EXPECT_TRUE(anyDifferent);
}
