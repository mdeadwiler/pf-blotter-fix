#include "qfblotter/HttpServer.hpp"

#include <chrono>
#include <condition_variable>
#include <cstring>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <set>
#include <string>

#include <httplib.h>
#include <nlohmann/json.hpp>

namespace qfblotter {

namespace {
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

}  // namespace

class HttpServer::Impl {
public:
    Impl(int port, SnapshotProvider snapshotProvider)
        : port_(port), snapshotProvider_(std::move(snapshotProvider)) {
        
        // CORS middleware for all requests
        server_.set_default_headers({
            {"Access-Control-Allow-Origin", "*"},
            {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
            {"Access-Control-Allow-Headers", "Content-Type"}
        });

        // Handle CORS preflight
        server_.Options(".*", [](const httplib::Request&, httplib::Response& res) {
            res.set_content("", "text/plain");
        });

        server_.Get("/health", [](const httplib::Request&, httplib::Response& res) {
            res.set_content("ok", "text/plain");
        });

        server_.Get("/snapshot", [this](const httplib::Request&, httplib::Response& res) {
            res.set_content(snapshotProvider_(), "application/json");
        });

        // POST /order - Submit new order
        server_.Post("/order", [this](const httplib::Request& req, httplib::Response& res) {
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

        // POST /cancel - Cancel order
        server_.Post("/cancel", [this](const httplib::Request& req, httplib::Response& res) {
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

private:
    int port_;
    SnapshotProvider snapshotProvider_;
    OrderHandler orderHandler_;
    CancelHandler cancelHandler_;
    OrderBookProvider orderBookProvider_;
    StatsProvider statsProvider_;
    MarketDataProvider marketDataProvider_;
    httplib::Server server_;
    std::atomic<bool> running_{false};
    std::thread thread_;
    SseBroker broker_;
    SseBroker marketBroker_;  // Separate broker for market data
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

void HttpServer::setOrderBookProvider(OrderBookProvider provider) {
    impl_->setOrderBookProvider(std::move(provider));
}

void HttpServer::setStatsProvider(StatsProvider provider) {
    impl_->setStatsProvider(std::move(provider));
}

void HttpServer::setMarketDataProvider(MarketDataProvider provider) {
    impl_->setMarketDataProvider(std::move(provider));
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
