#pragma once

#include <atomic>
#include <functional>
#include <string>

#include <quickfix/Application.h>
#include <quickfix/MessageCracker.h>

namespace FIX44 {
class NewOrderSingle;
class OrderCancelRequest;
}  // namespace FIX44

namespace qfblotter {

class OrderStore;
class MarketSim;

class FixApplication final : public FIX::Application, public FIX::MessageCracker {
public:
    using EventPublisher = std::function<void(const std::string&)>;

    FixApplication(OrderStore& store, MarketSim& market, EventPublisher publisher);

    void onCreate(const FIX::SessionID& sessionID) override;
    void onLogon(const FIX::SessionID& sessionID) override;
    void onLogout(const FIX::SessionID& sessionID) override;
    void toAdmin(FIX::Message& message, const FIX::SessionID& sessionID) override;
    void fromAdmin(const FIX::Message& message, const FIX::SessionID& sessionID) override;
    void toApp(FIX::Message& message, const FIX::SessionID& sessionID) override;
    void fromApp(const FIX::Message& message, const FIX::SessionID& sessionID) override;

private:
    void onMessage(const FIX44::NewOrderSingle& message, const FIX::SessionID& sessionID) override;
    void onMessage(const FIX44::OrderCancelRequest& message, const FIX::SessionID& sessionID) override;

    std::string nextOrderId();
    std::string nextExecId();
    void publishSnapshot();

    OrderStore& store_;
    MarketSim& market_;
    EventPublisher publisher_;
    std::atomic<unsigned long long> orderCounter_{1};
    std::atomic<unsigned long long> execCounter_{1};
};

}  // namespace qfblotter
