#include "qfblotter/HttpServer.hpp"

#include <atomic>
#include <chrono>
#include <cmath>
#include <cctype>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <unordered_map>

#include <httplib.h>
#include <nlohmann/json.hpp>

namespace qfblotter {

namespace {

// Constants for validation and limits
constexpr size_t MAX_REQUEST_BODY_SIZE = 65536;  // 64KB max request body
constexpr size_t MAX_CLORDID_LENGTH = 64;
constexpr size_t MAX_SYMBOL_LENGTH = 16;
constexpr int MAX_QUANTITY = 1000000;
constexpr double MAX_PRICE = 1000000.0;

// Input validation helpers
bool isValidClOrdId(const std::string& clOrdId) {
    if (clOrdId.empty() || clOrdId.length() > MAX_CLORDID_LENGTH) return false;
    // Allow alphanumeric, underscore, hyphen
    for (char c : clOrdId) {
        if (!std::isalnum(c) && c != '_' && c != '-') return false;
    }
    return true;
}

bool isValidSymbol(const std::string& symbol) {
    if (symbol.empty() || symbol.length() > MAX_SYMBOL_LENGTH) return false;
    // Allow uppercase alphanumeric only
    for (char c : symbol) {
        if (!std::isalnum(c)) return false;
    }
    return true;
}

bool isValidQuantity(int qty) {
    return qty > 0 && qty <= MAX_QUANTITY;
}

bool isValidPrice(double price) {
    return price >= 0.0 && price <= MAX_PRICE && !std::isnan(price) && !std::isinf(price);
}

struct Subscriber {
    std::mutex mutex;
    std::condition_variable cv;
    std::deque<std::string> queue;
};

class SseBroker {
public:
    std::shared_ptr<Subscriber> subscribe() {
        auto sub = std::make_shared<Subscriber>();
        std::lock_guard<std::mutex> lock(mutex_);
        subscribers_.insert(sub);
        return sub;
    }

    void publish(const std::string& event) {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto it = subscribers_.begin(); it != subscribers_.end();) {
            if (auto sub = it->lock()) {
                {
                    std::lock_guard<std::mutex> qlock(sub->mutex);
                    sub->queue.push_back(event);
                }
                sub->cv.notify_one();
                ++it;
            } else {
                it = subscribers_.erase(it);
            }
        }
    }

private:
    std::mutex mutex_;
    std::set<std::weak_ptr<Subscriber>, std::owner_less<std::weak_ptr<Subscriber>>> subscribers_;
};

std::string sse_frame(const std::string& data) {
    // Use event type "update" to distinguish from other messages
    return "event: update\ndata: " + data + "\n\n";
}

std::string sse_market_frame(const std::string& data) {
    return "event: marketdata\ndata: " + data + "\n\n";
}

// Simple rate limiter with automatic cleanup - tracks requests per IP
class RateLimiter {
public:
    RateLimiter(int maxRequests, int windowSeconds)
        : maxRequests_(maxRequests), windowMs_(windowSeconds * 1000),
          running_(true) {
        // Start background cleanup thread
        cleanupThread_ = std::thread([this]() {
            while (running_.load()) {
                std::this_thread::sleep_for(std::chrono::seconds(60));
                if (running_.load()) {
                    cleanup();
                }
            }
        });
    }
    
    ~RateLimiter() {
        running_.store(false);
        if (cleanupThread_.joinable()) {
            cleanupThread_.join();
        }
    }
    
    // Non-copyable
    RateLimiter(const RateLimiter&) = delete;
    RateLimiter& operator=(const RateLimiter&) = delete;

    bool allow(const std::string& ip) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto now = std::chrono::steady_clock::now();
        auto& record = records_[ip];
        
        // Remove old entries outside the window
        auto windowStart = now - std::chrono::milliseconds(windowMs_);
        while (!record.empty() && record.front() < windowStart) {
            record.pop_front();
        }
        
        // Check if under limit
        if (static_cast<int>(record.size()) >= maxRequests_) {
            return false;
        }
        
        // Record this request
        record.push_back(now);
        return true;
    }

private:
    // Cleanup old entries - runs periodically in background
    void cleanup() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto now = std::chrono::steady_clock::now();
        auto windowStart = now - std::chrono::milliseconds(windowMs_);
        
        for (auto it = records_.begin(); it != records_.end();) {
            while (!it->second.empty() && it->second.front() < windowStart) {
                it->second.pop_front();
            }
            if (it->second.empty()) {
                it = records_.erase(it);
            } else {
                ++it;
            }
        }
    }

    int maxRequests_;
    int windowMs_;
    std::mutex mutex_;
    std::unordered_map<std::string, std::deque<std::chrono::steady_clock::time_point>> records_;
    std::atomic<bool> running_;
    std::thread cleanupThread_;
};

// Get allowed CORS origins from environment or use defaults
std::string getAllowedOrigins() {
    const char* env = std::getenv("CORS_ALLOWED_ORIGINS");
    if (env && *env) {
        return env;
    }
    // Default: allow localhost for dev, and production domain
    return "http://localhost:5173, http://localhost:3000, https://quantblottersim.onrender.com";
}

}  // namespace

class HttpServer::Impl {
public:
    Impl(int port, SnapshotProvider snapshotProvider)
        : port_(port), snapshotProvider_(std::move(snapshotProvider)),
          orderRateLimiter_(60, 60),   // 60 orders per minute per IP
          cancelRateLimiter_(30, 60) { // 30 cancels per minute per IP
        
        // CORS middleware - use environment variable or safe defaults
        std::string allowedOrigins = getAllowedOrigins();
        server_.set_default_headers({
            {"Access-Control-Allow-Origin", allowedOrigins},
            {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
            {"Access-Control-Allow-Headers", "Content-Type"},
            {"Access-Control-Max-Age", "86400"}  // Cache preflight for 24h
        });

        // Handle CORS preflight
        server_.Options(".*", [](const httplib::Request&, httplib::Response& res) {
            res.set_content("", "text/plain");
        });

        server_.Get("/health", [](const httplib::Request&, httplib::Response& res) {
            res.set_content("{\"status\":\"ok\"}", "application/json");
        });

        server_.Get("/snapshot", [this](const httplib::Request&, httplib::Response& res) {
            res.set_content(snapshotProvider_(), "application/json");
        });

        // POST /order - Submit new order (rate limited + validated)
        server_.Post("/order", [this](const httplib::Request& req, httplib::Response& res) {
            // Request size limit (DoS protection)
            if (req.body.size() > MAX_REQUEST_BODY_SIZE) {
                res.status = 413;
                res.set_content(R"({"error":"Request body too large"})", "application/json");
                return;
            }

            // Rate limiting check
            if (!orderRateLimiter_.allow(req.remote_addr)) {
                res.status = 429;
                res.set_content(R"({"error":"Rate limit exceeded. Max 60 orders/minute."})", "application/json");
                return;
            }

            if (!orderHandler_) {
                res.status = 501;
                res.set_content(R"({"error":"Order handler not configured"})", "application/json");
                return;
            }

            try {
                auto json = nlohmann::json::parse(req.body);
                OrderRequest order;
                order.clOrdId = json.at("clOrdId").get<std::string>();
                order.symbol = json.at("symbol").get<std::string>();
                std::string sideStr = json.at("side").get<std::string>();
                order.side = (sideStr == "Buy" || sideStr == "1") ? '1' : '2';
                order.quantity = json.at("quantity").get<int>();
                order.price = json.at("price").get<double>();
                std::string orderTypeStr = json.value("orderType", "Limit");
                order.orderType = (orderTypeStr == "Market" || orderTypeStr == "1") ? '1' : '2';

                // Input validation
                if (!isValidClOrdId(order.clOrdId)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid clOrdId: must be 1-64 alphanumeric characters"})", "application/json");
                    return;
                }
                if (!isValidSymbol(order.symbol)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid symbol: must be 1-16 alphanumeric characters"})", "application/json");
                    return;
                }
                if (!isValidQuantity(order.quantity)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid quantity: must be 1-1,000,000"})", "application/json");
                    return;
                }
                if (order.orderType == '2' && !isValidPrice(order.price)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid price: must be 0-1,000,000"})", "application/json");
                    return;
                }

                std::string errorMsg;
                bool success = orderHandler_(order, errorMsg);

                if (success) {
                    res.set_content(R"({"status":"ok"})", "application/json");
                } else {
                    res.status = 400;
                    nlohmann::json errJson;
                    errJson["error"] = errorMsg;
                    res.set_content(errJson.dump(), "application/json");
                }
            } catch (const std::exception& e) {
                res.status = 400;
                nlohmann::json errJson;
                errJson["error"] = std::string("Invalid request: ") + e.what();
                res.set_content(errJson.dump(), "application/json");
            }
        });

        // POST /cancel - Cancel order (rate limited + validated)
        server_.Post("/cancel", [this](const httplib::Request& req, httplib::Response& res) {
            // Request size limit
            if (req.body.size() > MAX_REQUEST_BODY_SIZE) {
                res.status = 413;
                res.set_content(R"({"error":"Request body too large"})", "application/json");
                return;
            }

            // Rate limiting check
            if (!cancelRateLimiter_.allow(req.remote_addr)) {
                res.status = 429;
                res.set_content(R"({"error":"Rate limit exceeded. Max 30 cancels/minute."})", "application/json");
                return;
            }

            if (!cancelHandler_) {
                res.status = 501;
                res.set_content(R"({"error":"Cancel handler not configured"})", "application/json");
                return;
            }

            try {
                auto json = nlohmann::json::parse(req.body);
                CancelRequest cancel;
                cancel.origClOrdId = json.at("origClOrdId").get<std::string>();
                cancel.clOrdId = json.value("clOrdId", cancel.origClOrdId + "_CXL");

                // Input validation
                if (!isValidClOrdId(cancel.origClOrdId) || !isValidClOrdId(cancel.clOrdId)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid clOrdId format"})", "application/json");
                    return;
                }

                std::string errorMsg;
                bool success = cancelHandler_(cancel, errorMsg);

                if (success) {
                    res.set_content(R"({"status":"ok"})", "application/json");
                } else {
                    res.status = 400;
                    nlohmann::json errJson;
                    errJson["error"] = errorMsg;
                    res.set_content(errJson.dump(), "application/json");
                }
            } catch (const std::exception& e) {
                res.status = 400;
                nlohmann::json errJson;
                errJson["error"] = std::string("Invalid request: ") + e.what();
                res.set_content(errJson.dump(), "application/json");
            }
        });

        // POST /amend - Amend order (rate limited + validated)
        server_.Post("/amend", [this](const httplib::Request& req, httplib::Response& res) {
            // Request size limit
            if (req.body.size() > MAX_REQUEST_BODY_SIZE) {
                res.status = 413;
                res.set_content(R"({"error":"Request body too large"})", "application/json");
                return;
            }

            if (!orderRateLimiter_.allow(req.remote_addr)) {
                res.status = 429;
                res.set_content(R"({"error":"Rate limit exceeded."})", "application/json");
                return;
            }

            if (!amendHandler_) {
                res.status = 501;
                res.set_content(R"({"error":"Amend handler not configured"})", "application/json");
                return;
            }

            try {
                auto json = nlohmann::json::parse(req.body);
                AmendRequest amend;
                amend.origClOrdId = json.at("origClOrdId").get<std::string>();
                amend.clOrdId = json.value("clOrdId", amend.origClOrdId + "_AMD");
                amend.newQuantity = json.value("quantity", 0);
                amend.newPrice = json.value("price", 0.0);

                // Input validation
                if (!isValidClOrdId(amend.origClOrdId) || !isValidClOrdId(amend.clOrdId)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid clOrdId format"})", "application/json");
                    return;
                }
                if (amend.newQuantity != 0 && !isValidQuantity(amend.newQuantity)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid quantity"})", "application/json");
                    return;
                }
                if (amend.newPrice != 0.0 && !isValidPrice(amend.newPrice)) {
                    res.status = 400;
                    res.set_content(R"({"error":"Invalid price"})", "application/json");
                    return;
                }

                std::string errorMsg;
                bool success = amendHandler_(amend, errorMsg);

                if (success) {
                    res.set_content(R"({"status":"ok"})", "application/json");
                } else {
                    res.status = 400;
                    nlohmann::json errJson;
                    errJson["error"] = errorMsg;
                    res.set_content(errJson.dump(), "application/json");
                }
            } catch (const std::exception& e) {
                res.status = 400;
                nlohmann::json errJson;
                errJson["error"] = std::string("Invalid request: ") + e.what();
                res.set_content(errJson.dump(), "application/json");
            }
        });

        // GET /market-hours - Check if market is open
        server_.Get("/market-hours", [this](const httplib::Request&, httplib::Response& res) {
            if (marketHoursProvider_) {
                res.set_content(marketHoursProvider_(), "application/json");
            } else {
                // Default implementation
                auto now = std::chrono::system_clock::now();
                auto time = std::chrono::system_clock::to_time_t(now);
                std::tm tm = *std::gmtime(&time);
                
                // Convert to ET (UTC-5 or UTC-4 for DST, simplified to UTC-5)
                int etHour = (tm.tm_hour + 19) % 24;  // UTC-5
                
                bool isWeekday = tm.tm_wday >= 1 && tm.tm_wday <= 5;
                bool isMarketHours = etHour >= 9 && etHour < 16;  // 9:30 AM - 4:00 PM ET (simplified)
                bool isOpen = isWeekday && isMarketHours;
                
                nlohmann::json j;
                j["isOpen"] = isOpen;
                j["currentTimeET"] = std::to_string(etHour) + ":" + (tm.tm_min < 10 ? "0" : "") + std::to_string(tm.tm_min);
                j["marketOpen"] = "09:30";
                j["marketClose"] = "16:00";
                j["message"] = isOpen ? "Market is open" : "Market is closed";
                
                res.set_content(j.dump(), "application/json");
            }
        });

        // GET /stats - Get performance statistics
        server_.Get("/stats", [this](const httplib::Request&, httplib::Response& res) {
            if (!statsProvider_) {
                res.status = 501;
                res.set_content(R"({"error":"Stats not available"})", "application/json");
                return;
            }
            res.set_content(statsProvider_(), "application/json");
        });

        // GET /orderbook?symbol=AAPL - Get order book for symbol
        server_.Get("/orderbook", [this](const httplib::Request& req, httplib::Response& res) {
            if (!orderBookProvider_) {
                res.status = 501;
                res.set_content(R"({"error":"Order book not available"})", "application/json");
                return;
            }

            std::string symbol = req.get_param_value("symbol");
            if (symbol.empty()) {
                symbol = "AAPL";  // Default symbol
            }

            res.set_content(orderBookProvider_(symbol), "application/json");
        });

        server_.Get("/events", [this](const httplib::Request&, httplib::Response& res) {
            auto sub = broker_.subscribe();
            res.set_header("Cache-Control", "no-cache");
            res.set_header("Connection", "keep-alive");
            res.set_header("X-Accel-Buffering", "no");

            res.set_chunked_content_provider(
                "text/event-stream",
                [sub](size_t, httplib::DataSink& sink) {
                    std::unique_lock<std::mutex> lock(sub->mutex);
                    if (sub->queue.empty()) {
                        if (sub->cv.wait_for(lock, std::chrono::seconds(5)) == std::cv_status::timeout) {
                            const char* ping = ": ping\n\n";
                            sink.write(ping, std::strlen(ping));
                            return sink.is_writable();
                        }
                    }

                    if (!sub->queue.empty()) {
                        std::string payload = sse_frame(sub->queue.front());
                        sub->queue.pop_front();
                        lock.unlock();
                        sink.write(payload.c_str(), payload.size());
                    }

                    return sink.is_writable();
                },
                [](bool) {}
            );
        });

        // GET /marketdata - SSE stream for market data ticks
        server_.Get("/marketdata", [this](const httplib::Request&, httplib::Response& res) {
            auto sub = marketBroker_.subscribe();
            res.set_header("Cache-Control", "no-cache");
            res.set_header("Connection", "keep-alive");
            res.set_header("X-Accel-Buffering", "no");

            res.set_chunked_content_provider(
                "text/event-stream",
                [sub](size_t, httplib::DataSink& sink) {
                    std::unique_lock<std::mutex> lock(sub->mutex);
                    if (sub->queue.empty()) {
                        if (sub->cv.wait_for(lock, std::chrono::seconds(1)) == std::cv_status::timeout) {
                            const char* ping = ": ping\n\n";
                            sink.write(ping, std::strlen(ping));
                            return sink.is_writable();
                        }
                    }

                    if (!sub->queue.empty()) {
                        std::string payload = sse_market_frame(sub->queue.front());
                        sub->queue.pop_front();
                        lock.unlock();
                        sink.write(payload.c_str(), payload.size());
                    }

                    return sink.is_writable();
                },
                [](bool) {}
            );
        });
    }

    void setOrderHandler(OrderHandler handler) {
        orderHandler_ = std::move(handler);
    }

    void setCancelHandler(CancelHandler handler) {
        cancelHandler_ = std::move(handler);
    }

    void setOrderBookProvider(OrderBookProvider provider) {
        orderBookProvider_ = std::move(provider);
    }

    void setStatsProvider(StatsProvider provider) {
        statsProvider_ = std::move(provider);
    }

    void setMarketDataProvider(MarketDataProvider provider) {
        marketDataProvider_ = std::move(provider);
    }

    void start() {
        if (running_.exchange(true)) {
            return;
        }
        // Ensure any previous thread is cleaned up before starting a new one
        if (thread_.joinable()) {
            thread_.join();
        }
        thread_ = std::thread([this]() { server_.listen("0.0.0.0", port_); });
    }

    void stop() {
        if (!running_.exchange(false)) {
            return;
        }
        server_.stop();
        if (thread_.joinable()) {
            thread_.join();
        }
    }

    void publishEvent(const std::string& eventJson) {
        broker_.publish(eventJson);
    }

    void publishMarketData(const std::string& marketDataJson) {
        marketBroker_.publish(marketDataJson);
    }

    void setAmendHandler(AmendHandler handler) {
        amendHandler_ = std::move(handler);
    }

    void setMarketHoursProvider(MarketHoursProvider provider) {
        marketHoursProvider_ = std::move(provider);
    }

private:
    int port_;
    SnapshotProvider snapshotProvider_;
    OrderHandler orderHandler_;
    CancelHandler cancelHandler_;
    AmendHandler amendHandler_;
    OrderBookProvider orderBookProvider_;
    StatsProvider statsProvider_;
    MarketDataProvider marketDataProvider_;
    MarketHoursProvider marketHoursProvider_;
    httplib::Server server_;
    std::atomic<bool> running_{false};
    std::thread thread_;
    SseBroker broker_;
    SseBroker marketBroker_;  // Separate broker for market data
    RateLimiter orderRateLimiter_;   // Rate limiter for order submissions
    RateLimiter cancelRateLimiter_;  // Rate limiter for cancel requests
};

HttpServer::HttpServer(int port, SnapshotProvider snapshotProvider)
    : impl_(std::make_unique<Impl>(port, std::move(snapshotProvider))) {}

HttpServer::~HttpServer() {
    stop();
}

void HttpServer::setOrderHandler(OrderHandler handler) {
    impl_->setOrderHandler(std::move(handler));
}

void HttpServer::setCancelHandler(CancelHandler handler) {
    impl_->setCancelHandler(std::move(handler));
}

void HttpServer::setAmendHandler(AmendHandler handler) {
    impl_->setAmendHandler(std::move(handler));
}

void HttpServer::setOrderBookProvider(OrderBookProvider provider) {
    impl_->setOrderBookProvider(std::move(provider));
}

void HttpServer::setStatsProvider(StatsProvider provider) {
    impl_->setStatsProvider(std::move(provider));
}

void HttpServer::setMarketDataProvider(MarketDataProvider provider) {
    impl_->setMarketDataProvider(std::move(provider));
}

void HttpServer::setMarketHoursProvider(MarketHoursProvider provider) {
    impl_->setMarketHoursProvider(std::move(provider));
}

void HttpServer::start() {
    impl_->start();
}

void HttpServer::stop() {
    impl_->stop();
}

void HttpServer::publishEvent(const std::string& eventJson) {
    impl_->publishEvent(eventJson);
}

void HttpServer::publishMarketData(const std::string& marketDataJson) {
    impl_->publishMarketData(marketDataJson);
}

}  // namespace qfblotter
