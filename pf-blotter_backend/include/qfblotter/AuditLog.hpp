#pragma once

#include <chrono>
#include <fstream>
#include <mutex>
#include <string>

namespace qfblotter {

// Thread-safe, append-only audit log for regulatory compliance
class AuditLog {
public:
    enum class EventType {
        ORDER_NEW,
        ORDER_ACKNOWLEDGED,
        ORDER_FILLED,
        ORDER_PARTIAL_FILL,
        ORDER_REJECTED,
        ORDER_CANCELED,
        ORDER_CANCEL_REJECTED,
        ORDER_REPLACED,      // Order amendment
        ORDER_REPLACE_REJECTED,
        SYSTEM_START,
        SYSTEM_STOP,
        FIX_SESSION_LOGON,
        FIX_SESSION_LOGOUT
    };

    explicit AuditLog(const std::string& logPath);
    ~AuditLog();

    // Log an event (thread-safe, append-only)
    void log(EventType type, const std::string& clOrdId, const std::string& details);
    
    // System events
    void logSystemEvent(const std::string& event, const std::string& details);

    // Get log path
    std::string getLogPath() const { return logPath_; }

private:
    std::string eventTypeToString(EventType type) const;
    std::string currentTimestamp() const;

    std::string logPath_;
    std::ofstream file_;
    mutable std::mutex mutex_;
};

}  // namespace qfblotter
