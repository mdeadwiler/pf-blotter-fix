#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>

#include <quickfix/Application.h>
#include <quickfix/FileLog.h>
#include <quickfix/FileStore.h>
#include <quickfix/MessageCracker.h>
#include <quickfix/Session.h>
#include <quickfix/SessionSettings.h>
#include <quickfix/SocketInitiator.h>
#include <quickfix/fix44/NewOrderSingle.h>
#include <quickfix/fix44/OrderCancelRequest.h>

#include "qfblotter/Logger.hpp"

namespace {
struct OrderMeta {
    std::string symbol;
    char side{'1'};
};

char parse_side(const std::string& token) {
    if (token == "1" || token == "BUY" || token == "Buy" || token == "buy") {
        return '1';
    }
    if (token == "2" || token == "SELL" || token == "Sell" || token == "sell") {
        return '2';
    }
    return '0';
}
}  // namespace

class SenderApp final : public FIX::Application, public FIX::MessageCracker {
public:
    void onCreate(const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] onCreate " << sessionID.toString() << std::endl;
    }

    void onLogon(const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] onLogon " << sessionID.toString() << std::endl;
        sessionId_ = sessionID;
        loggedOn_ = true;
    }

    void onLogout(const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] onLogout " << sessionID.toString() << std::endl;
        loggedOn_ = false;
    }

    void toAdmin(FIX::Message& message, const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] toAdmin " << sessionID.toString() << " " << message.toString() << std::endl;
    }

    void fromAdmin(const FIX::Message& message, const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] fromAdmin " << sessionID.toString() << " " << message.toString() << std::endl;
    }

    void toApp(FIX::Message& message, const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] toApp " << sessionID.toString() << " " << message.toString() << std::endl;
    }

    void fromApp(const FIX::Message& message, const FIX::SessionID& sessionID) override {
        std::cout << "[SENDER] fromApp " << sessionID.toString() << " " << message.toString() << std::endl;
        crack(message, sessionID);
    }

    bool isReady() const { return loggedOn_; }

    bool sendNewOrder(const std::string& clOrdId, const std::string& symbol, char side,
                      int qty, double price) {
        if (!loggedOn_) {
            std::cerr << "[SENDER] not logged on\n";
            return false;
        }

        FIX44::NewOrderSingle nos;
        nos.set(FIX::ClOrdID(clOrdId));
        nos.set(FIX::HandlInst(FIX::HandlInst_AUTOMATED_EXECUTION_ORDER_PRIVATE_NO_BROKER_INTERVENTION));
        nos.set(FIX::Symbol(symbol));
        nos.set(FIX::Side(side));
        nos.set(FIX::TransactTime());
        nos.set(FIX::OrdType(FIX::OrdType_LIMIT));
        nos.set(FIX::OrderQty(qty));
        nos.set(FIX::Price(price));
        nos.set(FIX::TimeInForce(FIX::TimeInForce_DAY));

        try {
            FIX::Session::sendToTarget(nos, sessionId_);
            orders_[clOrdId] = OrderMeta{symbol, side};
            return true;
        } catch (const FIX::SessionNotFound&) {
            std::cerr << "[SENDER] Session not found\n";
            return false;
        }
    }

    bool sendCancel(const std::string& origClOrdId, const std::string& clOrdId) {
        if (!loggedOn_) {
            std::cerr << "[SENDER] not logged on\n";
            return false;
        }

        auto it = orders_.find(origClOrdId);
        if (it == orders_.end()) {
            std::cerr << "[SENDER] unknown origClOrdId. Send NOS first or use: cancel <orig> <clOrdId> <symbol> <side>\n";
            return false;
        }

        const auto& meta = it->second;
        FIX44::OrderCancelRequest cancel;
        cancel.set(FIX::OrigClOrdID(origClOrdId));
        cancel.set(FIX::ClOrdID(clOrdId));
        cancel.set(FIX::Side(meta.side));
        cancel.set(FIX::TransactTime());
        cancel.set(FIX::Symbol(meta.symbol));

        try {
            FIX::Session::sendToTarget(cancel, sessionId_);
            return true;
        } catch (const FIX::SessionNotFound&) {
            std::cerr << "[SENDER] Session not found\n";
            return false;
        }
    }

    bool sendCancelWithMeta(const std::string& origClOrdId, const std::string& clOrdId,
                            const std::string& symbol, char side) {
        if (!loggedOn_) {
            std::cerr << "[SENDER] not logged on\n";
            return false;
        }

        FIX44::OrderCancelRequest cancel;
        cancel.set(FIX::OrigClOrdID(origClOrdId));
        cancel.set(FIX::ClOrdID(clOrdId));
        cancel.set(FIX::Side(side));
        cancel.set(FIX::TransactTime());
        cancel.set(FIX::Symbol(symbol));

        try {
            FIX::Session::sendToTarget(cancel, sessionId_);
            return true;
        } catch (const FIX::SessionNotFound&) {
            std::cerr << "[SENDER] Session not found\n";
            return false;
        }
    }

private:
    bool loggedOn_{false};
    FIX::SessionID sessionId_;
    std::unordered_map<std::string, OrderMeta> orders_;
};

int main(int argc, char** argv) {
    std::string cfgPath = "config/initiator.cfg";
    if (argc > 1 && argv[1] && argv[1][0] != '\0') {
        cfgPath = argv[1];
    }

    try {
        qfblotter::Logger::init("qf_sender", "config/log/sender.log");
        auto log = qfblotter::Logger::get();

        FIX::SessionSettings settings(cfgPath);
        SenderApp app;
        FIX::FileStoreFactory storeFactory(settings);
        FIX::FileLogFactory logFactory(settings);
        FIX::SocketInitiator initiator(app, storeFactory, settings, logFactory);

        initiator.start();
        if (log) {
            log->info("sender started (fix_cfg={})", cfgPath);
        }
        std::cout << "[SENDER] running with " << cfgPath << "\n"
                  << "Commands:\n"
                  << "  nos <clOrdId> <symbol> <side(Buy|Sell)> <qty> <price>\n"
                  << "  cancel <origClOrdId> <clOrdId> [symbol] [side]\n"
                  << "  help\n"
                  << "  quit\n" << std::endl;

        std::string line;
        while (std::getline(std::cin, line)) {
            std::istringstream iss(line);
            std::string cmd;
            iss >> cmd;
            if (cmd.empty()) {
                continue;
            }
            if (cmd == "quit" || cmd == "exit") {
                break;
            }
            if (cmd == "help") {
                std::cout << "nos <clOrdId> <symbol> <side(Buy|Sell)> <qty> <price>\n"
                          << "cancel <origClOrdId> <clOrdId> [symbol] [side]\n"
                          << "quit\n";
                continue;
            }
            if (cmd == "nos") {
                std::string clOrdId, symbol, sideToken;
                int qty = 0;
                double price = 0.0;
                if (!(iss >> clOrdId >> symbol >> sideToken >> qty >> price)) {
                    std::cerr << "[SENDER] usage: nos <clOrdId> <symbol> <side> <qty> <price>\n";
                    continue;
                }
                char side = parse_side(sideToken);
                if (side != '1' && side != '2') {
                    std::cerr << "[SENDER] side must be Buy/Sell or 1/2\n";
                    continue;
                }
                app.sendNewOrder(clOrdId, symbol, side, qty, price);
                continue;
            }
            if (cmd == "cancel") {
                std::string origClOrdId, clOrdId, symbol, sideToken;
                if (!(iss >> origClOrdId >> clOrdId)) {
                    std::cerr << "[SENDER] usage: cancel <origClOrdId> <clOrdId> [symbol] [side]\n";
                    continue;
                }
                if (iss >> symbol >> sideToken) {
                    char side = parse_side(sideToken);
                    if (side != '1' && side != '2') {
                        std::cerr << "[SENDER] side must be Buy/Sell or 1/2\n";
                        continue;
                    }
                    app.sendCancelWithMeta(origClOrdId, clOrdId, symbol, side);
                } else {
                    app.sendCancel(origClOrdId, clOrdId);
                }
                continue;
            }
            std::cerr << "[SENDER] unknown command. Type 'help'.\n";
        }
        initiator.stop();
    } catch (const FIX::ConfigError& e) {
        std::cerr << "[SENDER] ConfigError: " << e.what() << std::endl;
        return 1;
    } catch (const FIX::RuntimeError& e) {
        std::cerr << "[SENDER] RuntimeError: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "[SENDER] Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
