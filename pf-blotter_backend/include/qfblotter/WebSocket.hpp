#pragma once

#include <atomic>
#include <condition_variable>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace qfblotter {

// WebSocket frame opcodes
enum class WsOpcode : uint8_t {
    Continuation = 0x0,
    Text = 0x1,
    Binary = 0x2,
    Close = 0x8,
    Ping = 0x9,
    Pong = 0xA
};

// Lightweight WebSocket connection handler
// Implements RFC 6455 for real-time streaming with sub-millisecond latency
class WebSocketConnection {
public:
    using MessageHandler = std::function<void(const std::string&)>;
    using CloseHandler = std::function<void()>;
    
    explicit WebSocketConnection(int fd);
    ~WebSocketConnection();
    
    // Send a text message
    bool send(const std::string& message);
    
    // Send a binary message
    bool sendBinary(const std::vector<uint8_t>& data);
    
    // Close the connection
    void close(uint16_t code = 1000, const std::string& reason = "");
    
    // Check if connection is open
    bool isOpen() const { return open_.load(); }
    
    // Set handlers
    void onMessage(MessageHandler handler) { messageHandler_ = std::move(handler); }
    void onClose(CloseHandler handler) { closeHandler_ = std::move(handler); }
    
    // Process incoming data (call from read loop)
    void processIncoming(const uint8_t* data, size_t len);
    
    // Get connection ID
    std::string getId() const { return id_; }
    
private:
    std::vector<uint8_t> encodeFrame(WsOpcode opcode, const uint8_t* payload, size_t len);
    void decodeFrame(const uint8_t* data, size_t len);
    
    int fd_;
    std::string id_;
    std::atomic<bool> open_{true};
    std::vector<uint8_t> buffer_;
    MessageHandler messageHandler_;
    CloseHandler closeHandler_;
    mutable std::mutex mutex_;
};

// WebSocket server that manages multiple connections
class WebSocketServer {
public:
    using ConnectionHandler = std::function<void(std::shared_ptr<WebSocketConnection>)>;
    
    WebSocketServer() = default;
    ~WebSocketServer();
    
    // Set handler for new connections
    void onConnection(ConnectionHandler handler) { connectionHandler_ = std::move(handler); }
    
    // Broadcast message to all connected clients
    void broadcast(const std::string& message);
    
    // Get number of connected clients
    size_t connectionCount() const;
    
    // Handle HTTP upgrade request (returns WebSocket accept key)
    static std::string computeAcceptKey(const std::string& clientKey);
    
    // Check if request is a WebSocket upgrade
    static bool isUpgradeRequest(const std::string& upgradeHeader, const std::string& connectionHeader);
    
    // Register a new connection
    void addConnection(std::shared_ptr<WebSocketConnection> conn);
    
    // Remove a connection
    void removeConnection(const std::string& id);
    
private:
    mutable std::mutex mutex_;
    std::unordered_map<std::string, std::shared_ptr<WebSocketConnection>> connections_;
    ConnectionHandler connectionHandler_;
};

// Utility to compute SHA-1 hash for WebSocket handshake
std::string sha1(const std::string& input);
std::string base64Encode(const std::vector<uint8_t>& data);

}  // namespace qfblotter
