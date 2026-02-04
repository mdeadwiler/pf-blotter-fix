#include <atomic>
#include <chrono>
#include <csignal>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include <nlohmann/json.hpp>

// Global shutdown flag for signal handling
namespace {
std::atomic<bool> g_shutdown{false};

void signalHandler(int signum) {
    (void)signum;  // Unused
    g_shutdown.store(true);
}
}  // namespace
#include <quickfix/FileLog.h>
#include <quickfix/FileStore.h>
#include <quickfix/SessionSettings.h>
#include <quickfix/SocketAcceptor.h>

#include "qfblotter/AuditLog.hpp"
#include "qfblotter/FixApplication.hpp"
#include "qfblotter/HttpServer.hpp"
#include "qfblotter/Logger.hpp"
#include "qfblotter/MarketSim.hpp"
#include "qfblotter/OrderStore.hpp"
#include "qfblotter/Persistence.hpp"

namespace {

// Pre-trade risk limits (same as FixApplication)
constexpr int MAX_ORDER_QTY = 10000;
constexpr double MAX_NOTIONAL = 1'000'000.0;

std::string utc_now_iso() {
    using namespace std::chrono;
    auto now = system_clock::now();
    std::time_t t = system_clock::to_time_t(now);
    std::tm tm{};
#if defined(_WIN32)
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

// Fill simulator - runs partial fills in background
class FillSimulator {
public:
    FillSimulator(qfblotter::OrderStore& store, qfblotter::MarketSim& market,
                  qfblotter::HttpServer& http)
        : store_(store), market_(market), http_(http), running_(false) {}

    void start() {
        running_ = true;
        thread_ = std::thread([this]() { run(); });
    }

    void stop() {
        running_ = false;
        if (thread_.joinable()) {
            thread_.join();
        }
    }

private:
    void run() {
        while (running_) {
            std::this_thread::sleep_for(std::chrono::milliseconds(500));  // Check every 500ms
            
            // Get all open orders
            auto openOrders = store_.getOpenOrders();
            bool anyFilled = false;
            
            for (const auto& order : openOrders) {
                auto result = market_.attemptFill(order.symbol, order.side, order.price, order.leavesQty);
                
                if (result.fillQty > 0) {
                    int newCumQty = order.cumQty + result.fillQty;
                    int newLeavesQty = order.quantity - newCumQty;
                    
                    // Calculate VWAP (volume-weighted average price)
                    double newAvgPx = (order.avgPx * order.cumQty + result.fillPx * result.fillQty) / newCumQty;
                    
                    std::string newStatus = (newLeavesQty <= 0) ? "FILLED" : "PARTIAL";
                    store_.updateStatus(order.clOrdId, newStatus, newLeavesQty, newCumQty, newAvgPx);
                    anyFilled = true;
                }
            }
            
            if (anyFilled) {
                http_.publishEvent(store_.snapshotString());
            }
        }
    }

    qfblotter::OrderStore& store_;
    qfblotter::MarketSim& market_;
    qfblotter::HttpServer& http_;
    std::atomic<bool> running_;
    std::thread thread_;
};

// Market data feed - publishes price ticks
class MarketDataFeed {
public:
    MarketDataFeed(qfblotter::MarketSim& market, qfblotter::HttpServer& http,
                   const std::vector<std::string>& symbols)
        : market_(market), http_(http), symbols_(symbols), running_(false) {}

    void start() {
        running_ = true;
        thread_ = std::thread([this]() { run(); });
    }

    void stop() {
        running_ = false;
        if (thread_.joinable()) {
            thread_.join();
        }
    }

private:
    void run() {
        while (running_) {
            std::this_thread::sleep_for(std::chrono::milliseconds(250));  // 4 ticks per second
            
            nlohmann::json ticks = nlohmann::json::array();
            
            for (const auto& symbol : symbols_) {
                double price = market_.nextTick(symbol);
                nlohmann::json tick;
                tick["symbol"] = symbol;
                tick["price"] = std::round(price * 100.0) / 100.0;
                tick["timestamp"] = utc_now_iso();
                ticks.push_back(tick);
            }
            
            http_.publishMarketData(ticks.dump());
        }
    }

    qfblotter::MarketSim& market_;
    qfblotter::HttpServer& http_;
    std::vector<std::string> symbols_;
    std::atomic<bool> running_;
    std::thread thread_;
};

}  // namespace

int main(int argc, char** argv) {
    std::string cfgPath = "config/acceptor.cfg";
    int httpPort = 8080;

    if (argc > 1 && argv[1] && argv[1][0] != '\0') {
        cfgPath = argv[1];
    }
    if (argc > 2) {
        httpPort = std::stoi(argv[2]);
    }

    try {
        qfblotter::Logger::init("qf_gateway", "config/log/gateway.log");
        auto log = qfblotter::Logger::get();

        FIX::SessionSettings settings(cfgPath);
        qfblotter::OrderStore store;
        qfblotter::MarketSim market(42);
        qfblotter::AuditLog audit("config/log/audit.log");
        
        // Persistence layer - saves orders every 5 seconds and on shutdown
        qfblotter::PersistenceManager persistence("data/orders.json", 5);
        
        // Load existing orders from last session
        int loadedOrders = persistence.load([&store](const qfblotter::OrderRecord& record) {
            store.upsert(record);
        });
        if (loadedOrders > 0) {
            std::cout << "[GATEWAY] Recovered " << loadedOrders << " orders from previous session" << std::endl;
        }
        
        qfblotter::HttpServer http(httpPort, [&store]() { return store.snapshotString(); });
        
        audit.logSystemEvent("GATEWAY_START", "Gateway starting on port " + std::to_string(httpPort));

        // Counters for UI-generated orders
        std::atomic<unsigned long long> uiOrderCounter{1};
        std::atomic<unsigned long long> uiExecCounter{1};

        auto nextUiOrderId = [&uiOrderCounter]() {
            return "UI_ORD" + std::to_string(uiOrderCounter.fetch_add(1));
        };

        // Order handler for UI submissions
        http.setOrderHandler([&](const qfblotter::OrderRequest& req, std::string& errorMsg) -> bool {
            // Validation
            if (req.symbol.empty()) {
                errorMsg = "Symbol is required";
                return false;
            }
            if (req.side != '1' && req.side != '2') {
                errorMsg = "Invalid side (must be 1=Buy or 2=Sell)";
                return false;
            }
            if (req.quantity <= 0) {
                errorMsg = "Quantity must be positive";
                return false;
            }
            // Price check - only for limit orders (orderType '2')
            if (req.orderType != '1' && req.price <= 0.0) {
                errorMsg = "Price must be positive for Limit orders";
                return false;
            }
            if (req.quantity > MAX_ORDER_QTY) {
                errorMsg = "Order quantity exceeds limit (" + std::to_string(MAX_ORDER_QTY) + ")";
                return false;
            }
            
            // For market orders, get current market price for notional check
            bool isMarketOrder = (req.orderType == '1');
            double orderPrice = isMarketOrder ? market.mark(req.symbol) : req.price;
            
            double notional = req.quantity * orderPrice;
            if (notional > MAX_NOTIONAL) {
                errorMsg = "Notional exceeds limit ($" + std::to_string(static_cast<int>(MAX_NOTIONAL)) + ")";
                return false;
            }
            if (store.exists(req.clOrdId)) {
                errorMsg = "Duplicate ClOrdID";
                return false;
            }

            // Create order record with timing
            auto submitTime = std::chrono::steady_clock::now();
            auto submitTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(
                submitTime.time_since_epoch()).count();
            
            std::string orderId = nextUiOrderId();
            qfblotter::OrderRecord record;
            record.clOrdId = req.clOrdId;
            record.orderId = orderId;
            record.symbol = req.symbol;
            record.side = req.side;
            record.price = orderPrice;  // Use market price for market orders
            record.quantity = req.quantity;
            record.leavesQty = req.quantity;
            record.cumQty = 0;
            record.avgPx = 0.0;
            record.status = "NEW";
            record.transactTime = utc_now_iso();
            record.submitTimeUs = submitTimeUs;
            
            // Calculate latency (time from submit to ack)
            auto ackTime = std::chrono::steady_clock::now();
            record.ackTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(
                ackTime.time_since_epoch()).count();
            record.latencyUs = record.ackTimeUs - record.submitTimeUs;
            
            store.upsert(record);
            
            // Audit log entry
            std::string orderTypeStr = isMarketOrder ? "MARKET" : "LIMIT";
            audit.log(qfblotter::AuditLog::EventType::ORDER_NEW, req.clOrdId,
                "type=" + orderTypeStr + ",symbol=" + req.symbol + ",side=" + std::string(1, req.side) +
                ",qty=" + std::to_string(req.quantity) + ",px=" + std::to_string(orderPrice));

            // For market orders, fill immediately at market price
            if (isMarketOrder) {
                double fillPrice = market.nextTick(req.symbol);
                store.updateStatus(req.clOrdId, "FILLED", 0, req.quantity, fillPrice);
                record.fillTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(
                    std::chrono::steady_clock::now().time_since_epoch()).count();
                
                audit.log(qfblotter::AuditLog::EventType::ORDER_FILLED, req.clOrdId,
                    "fillPx=" + std::to_string(fillPrice) + ",fillQty=" + std::to_string(req.quantity));
            }
            
            // Publish update
            http.publishEvent(store.snapshotString());
            return true;
        });

        // Cancel handler for UI submissions
        http.setCancelHandler([&](const qfblotter::CancelRequest& req, std::string& errorMsg) -> bool {
            auto existing = store.get(req.origClOrdId);
            if (!existing.has_value()) {
                errorMsg = "Unknown order: " + req.origClOrdId;
                return false;
            }

            const auto& record = existing.value();
            if (record.status == "FILLED") {
                errorMsg = "Cannot cancel filled order";
                return false;
            }
            if (record.status == "CANCELED") {
                errorMsg = "Order already canceled";
                return false;
            }
            if (record.status == "REJECTED") {
                errorMsg = "Cannot cancel rejected order";
                return false;
            }

            store.updateStatus(req.origClOrdId, "CANCELED", 0, 0, 0.0);
            
            // Audit log entry
            audit.log(qfblotter::AuditLog::EventType::ORDER_CANCELED, req.origClOrdId,
                "cancelClOrdId=" + req.clOrdId);
            
            http.publishEvent(store.snapshotString());
            return true;
        });

        // Amend handler for order modifications
        http.setAmendHandler([&](const qfblotter::AmendRequest& req, std::string& errorMsg) -> bool {
            auto existing = store.get(req.origClOrdId);
            if (!existing.has_value()) {
                errorMsg = "Unknown order: " + req.origClOrdId;
                return false;
            }

            auto record = existing.value();
            
            // Validate order state
            if (record.status == "FILLED") {
                errorMsg = "Cannot amend filled order";
                return false;
            }
            if (record.status == "CANCELED") {
                errorMsg = "Cannot amend canceled order";
                return false;
            }
            if (record.status == "REJECTED") {
                errorMsg = "Cannot amend rejected order";
                return false;
            }

            // Apply amendments
            bool amended = false;
            std::string amendDetails;
            
            if (req.newQuantity > 0 && req.newQuantity != record.quantity) {
                // Can only reduce quantity, not increase
                if (req.newQuantity > record.quantity) {
                    errorMsg = "Cannot increase order quantity (only reduce)";
                    return false;
                }
                if (req.newQuantity <= record.cumQty) {
                    errorMsg = "New quantity must be greater than already filled quantity";
                    return false;
                }
                amendDetails += "qty:" + std::to_string(record.quantity) + "->" + std::to_string(req.newQuantity);
                record.quantity = req.newQuantity;
                record.leavesQty = req.newQuantity - record.cumQty;
                amended = true;
            }
            
            if (req.newPrice > 0.0 && std::abs(req.newPrice - record.price) > 0.0001) {
                // Validate notional
                double newNotional = record.leavesQty * req.newPrice;
                if (newNotional > MAX_NOTIONAL) {
                    errorMsg = "Amended notional exceeds limit";
                    return false;
                }
                if (!amendDetails.empty()) amendDetails += ",";
                amendDetails += "px:" + std::to_string(record.price) + "->" + std::to_string(req.newPrice);
                record.price = req.newPrice;
                amended = true;
            }

            if (!amended) {
                errorMsg = "No changes specified";
                return false;
            }

            // Update the order with new clOrdId
            record.clOrdId = req.clOrdId;
            record.transactTime = utc_now_iso();
            store.upsert(record);
            
            // Remove old order reference and add new
            if (req.clOrdId != req.origClOrdId) {
                store.remove(req.origClOrdId);
            }
            
            audit.log(qfblotter::AuditLog::EventType::ORDER_REPLACED, req.origClOrdId,
                "newClOrdId=" + req.clOrdId + "," + amendDetails);
            
            http.publishEvent(store.snapshotString());
            return true;
        });

        // Stats provider - returns JSON performance metrics
        http.setStatsProvider([&store]() -> std::string {
            auto stats = store.getStats();
            nlohmann::json j;
            j["totalOrders"] = stats.totalOrders;
            j["newOrders"] = stats.newOrders;
            j["partialOrders"] = stats.partialOrders;
            j["filledOrders"] = stats.filledOrders;
            j["rejectedOrders"] = stats.rejectedOrders;
            j["canceledOrders"] = stats.canceledOrders;
            j["avgLatencyUs"] = stats.avgLatencyUs;
            j["minLatencyUs"] = stats.minLatencyUs;
            j["maxLatencyUs"] = stats.maxLatencyUs;
            j["p99LatencyUs"] = stats.p99LatencyUs;
            j["totalNotional"] = stats.totalNotional;
            j["filledNotional"] = stats.filledNotional;
            return j.dump();
        });

        // Order book provider - returns JSON for a symbol
        http.setOrderBookProvider([&market](const std::string& symbol) -> std::string {
            auto book = market.getOrderBook(symbol, 5);
            nlohmann::json j;
            j["symbol"] = book.symbol;
            j["lastPrice"] = book.lastPrice;
            j["spread"] = book.spread;
            
            j["bids"] = nlohmann::json::array();
            for (const auto& level : book.bids) {
                j["bids"].push_back({{"price", level.price}, {"quantity", level.quantity}});
            }
            
            j["asks"] = nlohmann::json::array();
            for (const auto& level : book.asks) {
                j["asks"].push_back({{"price", level.price}, {"quantity", level.quantity}});
            }
            
            return j.dump();
        });

        qfblotter::FixApplication app(store, market, [&http](const std::string& payload) {
            http.publishEvent(payload);
        });

        FIX::FileStoreFactory storeFactory(settings);
        FIX::FileLogFactory logFactory(settings);
        FIX::SocketAcceptor acceptor(app, storeFactory, settings, logFactory);

        // Start fill simulator for partial fills
        FillSimulator fillSim(store, market, http);

        // Start market data feed for common symbols
        std::vector<std::string> defaultSymbols = {"AAPL", "GOOGL", "MSFT", "NVDA", "TSLA", "AMZN"};
        MarketDataFeed marketFeed(market, http, defaultSymbols);

        http.start();
        fillSim.start();
        marketFeed.start();
        persistence.start(store);  // Start background persistence
        acceptor.start();
        // Register signal handlers for graceful shutdown
        std::signal(SIGINT, signalHandler);
        std::signal(SIGTERM, signalHandler);
        
        if (log) {
            log->info("gateway started (fix_cfg={}, http_port={})", cfgPath, httpPort);
        }
        std::cout << "[GATEWAY] running (FIX cfg: " << cfgPath
                  << ", HTTP port: " << httpPort << ")" << std::endl;
        std::cout << "[GATEWAY] Send SIGINT or SIGTERM to stop." << std::endl;
        
        // Wait for shutdown signal (container-friendly)
        while (!g_shutdown.load()) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
        
        std::cout << "[GATEWAY] Shutdown signal received." << std::endl;
        audit.logSystemEvent("GATEWAY_STOP", "Gateway shutting down");
        persistence.stop();  // Save orders before shutdown
        acceptor.stop();
        marketFeed.stop();
        fillSim.stop();
        http.stop();
    } catch (const FIX::ConfigError& e) {
        std::cerr << "[GATEWAY] ConfigError: " << e.what() << std::endl;
        return 1;
    } catch (const FIX::RuntimeError& e) {
        std::cerr << "[GATEWAY] RuntimeError: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "[GATEWAY] Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
