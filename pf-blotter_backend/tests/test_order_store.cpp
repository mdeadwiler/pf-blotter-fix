#include <gtest/gtest.h>
#include <thread>
#include <vector>
#include "qfblotter/OrderStore.hpp"

using namespace qfblotter;

class OrderStoreTest : public ::testing::Test {
protected:
    OrderStore store;
    
    OrderRecord createTestOrder(const std::string& clOrdId, int qty = 100, double price = 150.0) {
        OrderRecord order;
        order.clOrdId = clOrdId;
        order.orderId = "ORD_" + clOrdId;
        order.symbol = "AAPL";
        order.side = '1';  // Buy
        order.price = price;
        order.quantity = qty;
        order.leavesQty = qty;
        order.cumQty = 0;
        order.avgPx = 0.0;
        order.status = "NEW";
        order.transactTime = "2024-01-15T10:30:00Z";
        order.latencyUs = 50;
        return order;
    }
};

// Test: Order insertion and retrieval
TEST_F(OrderStoreTest, UpsertAndGet) {
    auto order = createTestOrder("TEST001");
    store.upsert(order);
    
    auto retrieved = store.get("TEST001");
    ASSERT_TRUE(retrieved.has_value());
    EXPECT_EQ(retrieved->clOrdId, "TEST001");
    EXPECT_EQ(retrieved->symbol, "AAPL");
    EXPECT_EQ(retrieved->quantity, 100);
    EXPECT_EQ(retrieved->status, "NEW");
}

// Test: Order existence check
TEST_F(OrderStoreTest, ExistsCheck) {
    EXPECT_FALSE(store.exists("NONEXISTENT"));
    
    auto order = createTestOrder("TEST002");
    store.upsert(order);
    
    EXPECT_TRUE(store.exists("TEST002"));
    EXPECT_FALSE(store.exists("NONEXISTENT"));
}

// Test: Status update
TEST_F(OrderStoreTest, StatusUpdate) {
    auto order = createTestOrder("TEST003", 1000);
    store.upsert(order);
    
    // Partial fill
    store.updateStatus("TEST003", "PARTIAL", 700, 300, 151.50);
    
    auto updated = store.get("TEST003");
    ASSERT_TRUE(updated.has_value());
    EXPECT_EQ(updated->status, "PARTIAL");
    EXPECT_EQ(updated->leavesQty, 700);
    EXPECT_EQ(updated->cumQty, 300);
    EXPECT_DOUBLE_EQ(updated->avgPx, 151.50);
}

// Test: Full fill
TEST_F(OrderStoreTest, FullFill) {
    auto order = createTestOrder("TEST004", 500);
    store.upsert(order);
    
    store.updateStatus("TEST004", "FILLED", 0, 500, 150.25);
    
    auto filled = store.get("TEST004");
    ASSERT_TRUE(filled.has_value());
    EXPECT_EQ(filled->status, "FILLED");
    EXPECT_EQ(filled->leavesQty, 0);
    EXPECT_EQ(filled->cumQty, 500);
}

// Test: Reject order
TEST_F(OrderStoreTest, RejectOrder) {
    auto order = createTestOrder("TEST005");
    store.upsert(order);
    
    store.reject("TEST005", "Exceeds position limit");
    
    auto rejected = store.get("TEST005");
    ASSERT_TRUE(rejected.has_value());
    EXPECT_EQ(rejected->status, "REJECTED");
    EXPECT_EQ(rejected->rejectReason, "Exceeds position limit");
}

// Test: Get open orders
TEST_F(OrderStoreTest, GetOpenOrders) {
    store.upsert(createTestOrder("NEW1"));
    store.upsert(createTestOrder("NEW2"));
    store.upsert(createTestOrder("PARTIAL1"));
    store.upsert(createTestOrder("FILLED1"));
    
    store.updateStatus("PARTIAL1", "PARTIAL", 50, 50, 150.0);
    store.updateStatus("FILLED1", "FILLED", 0, 100, 150.0);
    
    auto openOrders = store.getOpenOrders();
    EXPECT_EQ(openOrders.size(), 3);  // NEW1, NEW2, PARTIAL1
    
    // Verify only NEW and PARTIAL orders are returned
    for (const auto& o : openOrders) {
        EXPECT_TRUE(o.status == "NEW" || o.status == "PARTIAL");
    }
}

// Test: Statistics calculation
TEST_F(OrderStoreTest, StatsCalculation) {
    // Add orders with different statuses
    auto o1 = createTestOrder("S1", 100, 100.0);
    o1.latencyUs = 100;
    store.upsert(o1);
    
    auto o2 = createTestOrder("S2", 200, 50.0);
    o2.latencyUs = 200;
    store.upsert(o2);
    store.updateStatus("S2", "FILLED", 0, 200, 50.0);
    
    auto o3 = createTestOrder("S3", 150, 75.0);
    o3.latencyUs = 150;
    store.upsert(o3);
    store.reject("S3", "Risk limit");
    
    auto stats = store.getStats();
    
    EXPECT_EQ(stats.totalOrders, 3);
    EXPECT_EQ(stats.newOrders, 1);
    EXPECT_EQ(stats.filledOrders, 1);
    EXPECT_EQ(stats.rejectedOrders, 1);
    
    // Latency stats
    EXPECT_EQ(stats.minLatencyUs, 100);
    EXPECT_EQ(stats.maxLatencyUs, 200);
    EXPECT_EQ(stats.avgLatencyUs, 150);  // (100+200+150)/3
    
    // Notional
    EXPECT_DOUBLE_EQ(stats.totalNotional, 100*100.0 + 200*50.0 + 150*75.0);
    EXPECT_DOUBLE_EQ(stats.filledNotional, 200*50.0);
}

// Test: JSON snapshot
TEST_F(OrderStoreTest, JsonSnapshot) {
    auto order = createTestOrder("JSON1");
    store.upsert(order);
    
    auto json = store.snapshotJson();
    EXPECT_TRUE(json.is_array());
    EXPECT_EQ(json.size(), 1);
    EXPECT_EQ(json[0]["clOrdId"], "JSON1");
    EXPECT_EQ(json[0]["symbol"], "AAPL");
    EXPECT_EQ(json[0]["side"], "1");
}

// Test: Duplicate handling (upsert updates existing)
TEST_F(OrderStoreTest, UpsertUpdatesExisting) {
    auto order = createTestOrder("DUP1");
    store.upsert(order);
    
    order.status = "MODIFIED";
    order.price = 200.0;
    store.upsert(order);
    
    auto retrieved = store.get("DUP1");
    ASSERT_TRUE(retrieved.has_value());
    EXPECT_EQ(retrieved->status, "MODIFIED");
    EXPECT_DOUBLE_EQ(retrieved->price, 200.0);
    
    // Should still be only one order
    auto stats = store.getStats();
    EXPECT_EQ(stats.totalOrders, 1);
}

// Test: Thread safety (basic)
TEST_F(OrderStoreTest, ConcurrentAccess) {
    const int NUM_ORDERS = 100;
    
    // Concurrent writes
    std::vector<std::thread> threads;
    for (int i = 0; i < NUM_ORDERS; ++i) {
        threads.emplace_back([this, i]() {
            store.upsert(createTestOrder("CONCURRENT_" + std::to_string(i)));
        });
    }
    
    for (auto& t : threads) {
        t.join();
    }
    
    auto stats = store.getStats();
    EXPECT_EQ(stats.totalOrders, NUM_ORDERS);
}
