#include "qfblotter/FixApplication.hpp"

#include <chrono>
#include <iomanip>
#include <sstream>

#include <quickfix/Session.h>
#include <quickfix/fix44/ExecutionReport.h>
#include <quickfix/fix44/NewOrderSingle.h>
#include <quickfix/fix44/OrderCancelReject.h>
#include <quickfix/fix44/OrderCancelRequest.h>

#include "qfblotter/MarketSim.hpp"
#include "qfblotter/OrderStore.hpp"

namespace qfblotter {

namespace {
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
// Pre-trade risk limits
constexpr int MAX_ORDER_QTY = 10000;
constexpr double MAX_NOTIONAL = 1'000'000.0;

// FIX 4.4 OrdRejReason values (tag 103)
constexpr int ORD_REJ_UNKNOWN_SYMBOL = 1;
constexpr int ORD_REJ_ORDER_EXCEEDS_LIMIT = 3;
constexpr int ORD_REJ_DUPLICATE_ORDER = 6;
constexpr int ORD_REJ_OTHER = 99;

}  // namespace


FixApplication::FixApplication(OrderStore& store, MarketSim& market, EventPublisher publisher)
    : store_(store), market_(market), publisher_(std::move(publisher)) {}

void FixApplication::onCreate(const FIX::SessionID& sessionID) {
    (void)sessionID;
}

void FixApplication::onLogon(const FIX::SessionID& sessionID) {
    (void)sessionID;
}

void FixApplication::onLogout(const FIX::SessionID& sessionID) {
    (void)sessionID;
}

void FixApplication::toAdmin(FIX::Message& message, const FIX::SessionID& sessionID) {
    (void)message;
    (void)sessionID;
}

void FixApplication::fromAdmin(const FIX::Message& message, const FIX::SessionID& sessionID) {
    (void)message;
    (void)sessionID;
}

void FixApplication::toApp(FIX::Message& message, const FIX::SessionID& sessionID) {
    (void)message;
    (void)sessionID;
}

void FixApplication::fromApp(const FIX::Message& message, const FIX::SessionID& sessionID) {
    crack(message, sessionID);
}

void FixApplication::onMessage(const FIX44::NewOrderSingle& message, const FIX::SessionID& sessionID) {
    FIX::ClOrdID clOrdId;
    FIX::Symbol symbol;
    FIX::Side side;
    FIX::OrderQty orderQty;
    FIX::Price price;

    message.get(clOrdId);
    message.get(symbol);
    message.get(side);
    message.get(orderQty);

    bool hasPrice = message.isSetField(price);
    if (hasPrice) {
        message.get(price);
    }

    const int qty = static_cast<int>(orderQty.getValue());
    const double px = hasPrice ? price.getValue() : 0.0;
    const double notional = qty * px;

    // --- PRE-TRADE VALIDATION ---
    std::string rejectReason;
    int rejectCode = 0;

    if (symbol.getValue().empty()) {
        rejectReason = "Symbol is required";
        rejectCode = ORD_REJ_UNKNOWN_SYMBOL;
    } else if (side.getValue() != '1' && side.getValue() != '2') {
        rejectReason = "Invalid side (must be 1=Buy or 2=Sell)";
        rejectCode = ORD_REJ_OTHER;
    } else if (qty <= 0) {
        rejectReason = "OrderQty must be positive";
        rejectCode = ORD_REJ_OTHER;
    } else if (hasPrice && px <= 0.0) {
        rejectReason = "Price must be positive for limit orders";
        rejectCode = ORD_REJ_OTHER;
    } else if (qty > MAX_ORDER_QTY) {
        rejectReason = "Order quantity exceeds limit (" + std::to_string(MAX_ORDER_QTY) + ")";
        rejectCode = ORD_REJ_ORDER_EXCEEDS_LIMIT;
    } else if (hasPrice && notional > MAX_NOTIONAL) {
        rejectReason = "Notional exceeds limit ($" + std::to_string(static_cast<int>(MAX_NOTIONAL)) + ")";
        rejectCode = ORD_REJ_ORDER_EXCEEDS_LIMIT;
    } else if (store_.exists(clOrdId.getValue())) {
        rejectReason = "Duplicate ClOrdID";
        rejectCode = ORD_REJ_DUPLICATE_ORDER;
    }

    // --- REJECT PATH ---
    if (!rejectReason.empty()) {
        const std::string orderId = nextOrderId();
        const std::string execId = nextExecId();

        FIX44::ExecutionReport reject(
            FIX::OrderID(orderId),
            FIX::ExecID(execId),
            FIX::ExecType(FIX::ExecType_REJECTED),
            FIX::OrdStatus(FIX::OrdStatus_REJECTED),
            side,
            FIX::LeavesQty(0),
            FIX::CumQty(0),
            FIX::AvgPx(0)
        );

        reject.set(clOrdId);
        reject.set(symbol);
        reject.set(orderQty);
        reject.set(FIX::OrdRejReason(rejectCode));
        reject.set(FIX::Text(rejectReason));
        reject.set(FIX::TransactTime());

        FIX::Session::sendToTarget(reject, sessionID);

        // Record rejected order in store for UI visibility
        OrderRecord record;
        record.clOrdId = clOrdId.getValue();
        record.orderId = orderId;
        record.symbol = symbol.getValue();
        record.side = side.getValue();
        record.price = px;
        record.quantity = qty;
        record.leavesQty = 0;
        record.cumQty = 0;
        record.avgPx = 0.0;
        record.status = "REJECTED";
        record.rejectReason = rejectReason;
        record.transactTime = utc_now_iso();
        store_.upsert(record);

        publishSnapshot();
        return;
    }

    // --- ACK PATH ---
    const std::string orderId = nextOrderId();
    const std::string execId = nextExecId();

    FIX44::ExecutionReport ack(
        FIX::OrderID(orderId),
        FIX::ExecID(execId),
        FIX::ExecType(FIX::ExecType_NEW),
        FIX::OrdStatus(FIX::OrdStatus_NEW),
        side,
        FIX::LeavesQty(orderQty.getValue()),
        FIX::CumQty(0),
        FIX::AvgPx(0)
    );

    ack.set(clOrdId);
    ack.set(symbol);
    ack.set(orderQty);
    ack.set(FIX::TransactTime());
    if (hasPrice) {
        ack.set(price);
    }

    FIX::Session::sendToTarget(ack, sessionID);

    OrderRecord record;
    record.clOrdId = clOrdId.getValue();
    record.orderId = orderId;
    record.symbol = symbol.getValue();
    record.side = side.getValue();
    record.price = px;
    record.quantity = qty;
    record.leavesQty = qty;
    record.cumQty = 0;
    record.avgPx = 0.0;
    record.status = "NEW";
    record.transactTime = utc_now_iso();
    store_.upsert(record);

    // --- FILL PATH (if market crosses limit) ---
    if (hasPrice && market_.shouldFill(symbol.getValue(), side.getValue(), px)) {
        const std::string fillExecId = nextExecId();

        FIX44::ExecutionReport fill(
            FIX::OrderID(orderId),
            FIX::ExecID(fillExecId),
            FIX::ExecType(FIX::ExecType_TRADE),
            FIX::OrdStatus(FIX::OrdStatus_FILLED),
            side,
            FIX::LeavesQty(0),
            FIX::CumQty(orderQty.getValue()),
            FIX::AvgPx(px)
        );

        fill.set(clOrdId);
        fill.set(symbol);
        fill.set(orderQty);
        fill.set(price);
        fill.set(FIX::LastQty(orderQty.getValue()));
        fill.set(FIX::LastPx(px));
        fill.set(FIX::TransactTime());

        FIX::Session::sendToTarget(fill, sessionID);

        store_.updateStatus(record.clOrdId, "FILLED", 0, qty, px);
    }

    publishSnapshot();
}

void FixApplication::onMessage(const FIX44::OrderCancelRequest& message, const FIX::SessionID& sessionID) {
    FIX::OrigClOrdID origClOrdId;
    FIX::ClOrdID clOrdId;
    FIX::Symbol symbol;
    FIX::Side side;

    message.get(origClOrdId);
    message.get(clOrdId);
    message.get(symbol);
    message.get(side);

    auto existing = store_.get(origClOrdId.getValue());
    if (!existing.has_value()) {
        FIX44::OrderCancelReject reject(
            FIX::OrderID("UNKNOWN"),
            clOrdId,
            origClOrdId,
            FIX::OrdStatus(FIX::OrdStatus_REJECTED),
            FIX::CxlRejResponseTo(FIX::CxlRejResponseTo_ORDER_CANCEL_REQUEST)
        );
        reject.set(FIX::CxlRejReason(FIX::CxlRejReason_UNKNOWN_ORDER));
        FIX::Session::sendToTarget(reject, sessionID);
        return;
    }

    const auto& record = existing.value();
    if (record.status == "FILLED") {
        FIX44::OrderCancelReject reject(
            FIX::OrderID(record.orderId.empty() ? "UNKNOWN" : record.orderId),
            clOrdId,
            origClOrdId,
            FIX::OrdStatus(FIX::OrdStatus_FILLED),
            FIX::CxlRejResponseTo(FIX::CxlRejResponseTo_ORDER_CANCEL_REQUEST)
        );
        reject.set(FIX::CxlRejReason(FIX::CxlRejReason_TOO_LATE_TO_CANCEL));
        FIX::Session::sendToTarget(reject, sessionID);
        return;
    }

    if (record.status == "CANCELED") {
        FIX44::OrderCancelReject reject(
            FIX::OrderID(record.orderId.empty() ? "UNKNOWN" : record.orderId),
            clOrdId,
            origClOrdId,
            FIX::OrdStatus(FIX::OrdStatus_CANCELED),
            FIX::CxlRejResponseTo(FIX::CxlRejResponseTo_ORDER_CANCEL_REQUEST)
        );
        reject.set(FIX::CxlRejReason(FIX::CxlRejReason_DUPLICATE_CLORDID));
        FIX::Session::sendToTarget(reject, sessionID);
        return;
    }

    const std::string execId = nextExecId();
    FIX::ExecType execType(FIX::ExecType_CANCELED);
    FIX::OrdStatus ordStatus(FIX::OrdStatus_CANCELED);
    FIX::LeavesQty leaves(0);
    FIX::CumQty cum(0);
    FIX::AvgPx avg(0);

    FIX44::ExecutionReport cancel(
        FIX::OrderID(origClOrdId.getValue()),
        FIX::ExecID(execId),
        execType,
        ordStatus,
        side,
        leaves,
        cum,
        avg
    );

    cancel.set(clOrdId);
    cancel.set(origClOrdId);
    cancel.set(symbol);
    cancel.set(FIX::TransactTime());

    FIX::Session::sendToTarget(cancel, sessionID);

    store_.updateStatus(origClOrdId.getValue(), "CANCELED", 0, 0, 0.0);
    publishSnapshot();
}

std::string FixApplication::nextOrderId() {
    return "ORD" + std::to_string(orderCounter_.fetch_add(1));
}

std::string FixApplication::nextExecId() {
    return "EXEC" + std::to_string(execCounter_.fetch_add(1));
}

void FixApplication::publishSnapshot() {
    if (!publisher_) {
        return;
    }
    publisher_(store_.snapshotString());
}

}  // namespace qfblotter
