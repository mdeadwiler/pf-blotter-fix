#pragma once

#include <atomic>
#include <functional>
#include <memory>
#include <string>
#include <thread>

namespace qfblotter {

// Order request from UI
struct OrderRequest {
    std::string clOrdId;
    std::string symbol;
    char side;       // '1' = Buy, '2' = Sell
    int quantity;
    double price;
    char orderType;  // '1' = Market, '2' = Limit (default)
};

// Amend request from UI
struct AmendRequest {
    std::string origClOrdId;
    std::string clOrdId;
    int newQuantity;      // 0 = no change
    double newPrice;      // 0 = no change
};

// Cancel request from UI
struct CancelRequest {
    std::string origClOrdId;
    std::string clOrdId;
};

class HttpServer {
public:
    using SnapshotProvider = std::function<std::string()>;
    using OrderHandler = std::function<bool(const OrderRequest&, std::string&)>;
    using CancelHandler = std::function<bool(const CancelRequest&, std::string&)>;
    using AmendHandler = std::function<bool(const AmendRequest&, std::string&)>;
    using OrderBookProvider = std::function<std::string(const std::string&)>;
    using StatsProvider = std::function<std::string()>;
    using MarketDataProvider = std::function<std::string(const std::string&)>;
    using MarketHoursProvider = std::function<std::string()>;

    explicit HttpServer(int port, SnapshotProvider snapshotProvider);
    ~HttpServer();

    void setOrderHandler(OrderHandler handler);
    void setCancelHandler(CancelHandler handler);
    void setAmendHandler(AmendHandler handler);
    void setOrderBookProvider(OrderBookProvider provider);
    void setStatsProvider(StatsProvider provider);
    void setMarketDataProvider(MarketDataProvider provider);
    void setMarketHoursProvider(MarketHoursProvider provider);

    void start();
    void stop();

    void publishEvent(const std::string& eventJson);
    void publishMarketData(const std::string& marketDataJson);

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

}  // namespace qfblotter
