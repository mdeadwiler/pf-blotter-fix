#include "qfblotter/AuditLog.hpp"

#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace qfblotter {

AuditLog::AuditLog(const std::string& logPath)
    : logPath_(logPath) {
    file_.open(logPath_, std::ios::app);  // Append mode
    if (!file_.is_open()) {
        throw std::runtime_error("Failed to open audit log: " + logPath_);
    }
    
    // Log startup
    logSystemEvent("AUDIT_LOG_OPENED", "Audit log initialized");
}

AuditLog::~AuditLog() {
    if (file_.is_open()) {
        logSystemEvent("AUDIT_LOG_CLOSED", "Audit log closed");
        file_.close();
    }
}

void AuditLog::log(EventType type, const std::string& clOrdId, const std::string& details) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (!file_.is_open()) {
        return;
    }
    
    // Format: TIMESTAMP|EVENT_TYPE|CLORDID|DETAILS
    file_ << currentTimestamp() << "|"
          << eventTypeToString(type) << "|"
          << clOrdId << "|"
          << details << "\n";
    file_.flush();  // Ensure immediate write for durability
}

void AuditLog::logSystemEvent(const std::string& event, const std::string& details) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (!file_.is_open()) {
        return;
    }
    
    file_ << currentTimestamp() << "|"
          << "SYSTEM|"
          << event << "|"
          << details << "\n";
    file_.flush();
}

std::string AuditLog::eventTypeToString(EventType type) const {
    switch (type) {
        case EventType::ORDER_NEW: return "ORDER_NEW";
        case EventType::ORDER_ACKNOWLEDGED: return "ORDER_ACK";
        case EventType::ORDER_FILLED: return "ORDER_FILLED";
        case EventType::ORDER_PARTIAL_FILL: return "ORDER_PARTIAL";
        case EventType::ORDER_REJECTED: return "ORDER_REJECTED";
        case EventType::ORDER_CANCELED: return "ORDER_CANCELED";
        case EventType::ORDER_CANCEL_REJECTED: return "CANCEL_REJECTED";
        case EventType::ORDER_REPLACED: return "ORDER_REPLACED";
        case EventType::ORDER_REPLACE_REJECTED: return "REPLACE_REJECTED";
        case EventType::SYSTEM_START: return "SYS_START";
        case EventType::SYSTEM_STOP: return "SYS_STOP";
        case EventType::FIX_SESSION_LOGON: return "FIX_LOGON";
        case EventType::FIX_SESSION_LOGOUT: return "FIX_LOGOUT";
        default: return "UNKNOWN";
    }
}

std::string AuditLog::currentTimestamp() const {
    using namespace std::chrono;
    
    auto now = system_clock::now();
    auto ms = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;
    std::time_t t = system_clock::to_time_t(now);
    std::tm tm{};
    
#if defined(_WIN32)
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S")
        << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z';
    return oss.str();
}

}  // namespace qfblotter
