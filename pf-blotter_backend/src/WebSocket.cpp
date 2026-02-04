#include "qfblotter/WebSocket.hpp"

#include <algorithm>
#include <array>
#include <cstring>
#include <random>
#include <sstream>

#ifdef _WIN32
#include <winsock2.h>
#else
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace qfblotter {

namespace {

// Generate unique connection ID
std::string generateConnectionId() {
    static std::atomic<uint64_t> counter{0};
    std::stringstream ss;
    ss << "ws_" << counter.fetch_add(1) << "_" << std::chrono::steady_clock::now().time_since_epoch().count();
    return ss.str();
}

// SHA-1 implementation for WebSocket handshake
// Simplified version - in production, use OpenSSL or similar
class SHA1 {
public:
    SHA1() { reset(); }
    
    void update(const uint8_t* data, size_t len) {
        for (size_t i = 0; i < len; ++i) {
            buffer_[bufferSize_++] = data[i];
            if (bufferSize_ == 64) {
                processBlock();
                totalBits_ += 512;
                bufferSize_ = 0;
            }
        }
    }
    
    std::array<uint8_t, 20> finalize() {
        uint64_t totalBits = totalBits_ + bufferSize_ * 8;
        
        // Padding
        buffer_[bufferSize_++] = 0x80;
        while (bufferSize_ != 56) {
            if (bufferSize_ == 64) {
                processBlock();
                bufferSize_ = 0;
            }
            buffer_[bufferSize_++] = 0;
        }
        
        // Length in bits (big-endian)
        for (int i = 7; i >= 0; --i) {
            buffer_[bufferSize_++] = static_cast<uint8_t>(totalBits >> (i * 8));
        }
        processBlock();
        
        std::array<uint8_t, 20> result;
        for (int i = 0; i < 5; ++i) {
            result[i * 4] = static_cast<uint8_t>(h_[i] >> 24);
            result[i * 4 + 1] = static_cast<uint8_t>(h_[i] >> 16);
            result[i * 4 + 2] = static_cast<uint8_t>(h_[i] >> 8);
            result[i * 4 + 3] = static_cast<uint8_t>(h_[i]);
        }
        return result;
    }

private:
    void reset() {
        h_[0] = 0x67452301;
        h_[1] = 0xEFCDAB89;
        h_[2] = 0x98BADCFE;
        h_[3] = 0x10325476;
        h_[4] = 0xC3D2E1F0;
        bufferSize_ = 0;
        totalBits_ = 0;
    }
    
    void processBlock() {
        uint32_t w[80];
        for (int i = 0; i < 16; ++i) {
            w[i] = (static_cast<uint32_t>(buffer_[i * 4]) << 24) |
                   (static_cast<uint32_t>(buffer_[i * 4 + 1]) << 16) |
                   (static_cast<uint32_t>(buffer_[i * 4 + 2]) << 8) |
                   static_cast<uint32_t>(buffer_[i * 4 + 3]);
        }
        for (int i = 16; i < 80; ++i) {
            w[i] = rotl(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
        }
        
        uint32_t a = h_[0], b = h_[1], c = h_[2], d = h_[3], e = h_[4];
        
        for (int i = 0; i < 80; ++i) {
            uint32_t f, k;
            if (i < 20) {
                f = (b & c) | ((~b) & d);
                k = 0x5A827999;
            } else if (i < 40) {
                f = b ^ c ^ d;
                k = 0x6ED9EBA1;
            } else if (i < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8F1BBCDC;
            } else {
                f = b ^ c ^ d;
                k = 0xCA62C1D6;
            }
            
            uint32_t temp = rotl(a, 5) + f + e + k + w[i];
            e = d;
            d = c;
            c = rotl(b, 30);
            b = a;
            a = temp;
        }
        
        h_[0] += a;
        h_[1] += b;
        h_[2] += c;
        h_[3] += d;
        h_[4] += e;
    }
    
    static uint32_t rotl(uint32_t x, int n) {
        return (x << n) | (x >> (32 - n));
    }
    
    uint32_t h_[5];
    uint8_t buffer_[64];
    size_t bufferSize_;
    uint64_t totalBits_;
};

}  // namespace

std::string sha1(const std::string& input) {
    SHA1 hasher;
    hasher.update(reinterpret_cast<const uint8_t*>(input.data()), input.size());
    auto digest = hasher.finalize();
    return std::string(digest.begin(), digest.end());
}

std::string base64Encode(const std::vector<uint8_t>& data) {
    static const char* chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    result.reserve((data.size() + 2) / 3 * 4);
    
    for (size_t i = 0; i < data.size(); i += 3) {
        uint32_t n = static_cast<uint32_t>(data[i]) << 16;
        if (i + 1 < data.size()) n |= static_cast<uint32_t>(data[i + 1]) << 8;
        if (i + 2 < data.size()) n |= static_cast<uint32_t>(data[i + 2]);
        
        result += chars[(n >> 18) & 0x3F];
        result += chars[(n >> 12) & 0x3F];
        result += (i + 1 < data.size()) ? chars[(n >> 6) & 0x3F] : '=';
        result += (i + 2 < data.size()) ? chars[n & 0x3F] : '=';
    }
    
    return result;
}

// WebSocketConnection implementation

WebSocketConnection::WebSocketConnection(int fd)
    : fd_(fd), id_(generateConnectionId()) {}

WebSocketConnection::~WebSocketConnection() {
    close();
}

bool WebSocketConnection::send(const std::string& message) {
    if (!open_.load()) return false;
    
    std::lock_guard<std::mutex> lock(mutex_);
    auto frame = encodeFrame(WsOpcode::Text, 
                             reinterpret_cast<const uint8_t*>(message.data()), 
                             message.size());
    
#ifdef _WIN32
    return ::send(fd_, reinterpret_cast<const char*>(frame.data()), 
                  static_cast<int>(frame.size()), 0) > 0;
#else
    return ::send(fd_, frame.data(), frame.size(), 0) > 0;
#endif
}

bool WebSocketConnection::sendBinary(const std::vector<uint8_t>& data) {
    if (!open_.load()) return false;
    
    std::lock_guard<std::mutex> lock(mutex_);
    auto frame = encodeFrame(WsOpcode::Binary, data.data(), data.size());
    
#ifdef _WIN32
    return ::send(fd_, reinterpret_cast<const char*>(frame.data()), 
                  static_cast<int>(frame.size()), 0) > 0;
#else
    return ::send(fd_, frame.data(), frame.size(), 0) > 0;
#endif
}

void WebSocketConnection::close(uint16_t code, const std::string& reason) {
    if (!open_.exchange(false)) return;
    
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<uint8_t> payload;
    payload.push_back(static_cast<uint8_t>(code >> 8));
    payload.push_back(static_cast<uint8_t>(code & 0xFF));
    payload.insert(payload.end(), reason.begin(), reason.end());
    
    auto frame = encodeFrame(WsOpcode::Close, payload.data(), payload.size());
    
#ifdef _WIN32
    ::send(fd_, reinterpret_cast<const char*>(frame.data()), 
           static_cast<int>(frame.size()), 0);
    closesocket(fd_);
#else
    ::send(fd_, frame.data(), frame.size(), 0);
    ::close(fd_);
#endif
    
    if (closeHandler_) {
        closeHandler_();
    }
}

std::vector<uint8_t> WebSocketConnection::encodeFrame(WsOpcode opcode, 
                                                       const uint8_t* payload, 
                                                       size_t len) {
    std::vector<uint8_t> frame;
    
    // First byte: FIN + opcode
    frame.push_back(0x80 | static_cast<uint8_t>(opcode));
    
    // Second byte: mask bit (0 for server) + payload length
    if (len < 126) {
        frame.push_back(static_cast<uint8_t>(len));
    } else if (len < 65536) {
        frame.push_back(126);
        frame.push_back(static_cast<uint8_t>(len >> 8));
        frame.push_back(static_cast<uint8_t>(len & 0xFF));
    } else {
        frame.push_back(127);
        for (int i = 7; i >= 0; --i) {
            frame.push_back(static_cast<uint8_t>(len >> (i * 8)));
        }
    }
    
    // Payload
    frame.insert(frame.end(), payload, payload + len);
    
    return frame;
}

void WebSocketConnection::processIncoming(const uint8_t* data, size_t len) {
    buffer_.insert(buffer_.end(), data, data + len);
    
    while (buffer_.size() >= 2) {
        bool fin = (buffer_[0] & 0x80) != 0;
        WsOpcode opcode = static_cast<WsOpcode>(buffer_[0] & 0x0F);
        bool masked = (buffer_[1] & 0x80) != 0;
        size_t payloadLen = buffer_[1] & 0x7F;
        size_t headerLen = 2;
        
        if (payloadLen == 126) {
            if (buffer_.size() < 4) return;
            payloadLen = (static_cast<size_t>(buffer_[2]) << 8) | buffer_[3];
            headerLen = 4;
        } else if (payloadLen == 127) {
            if (buffer_.size() < 10) return;
            payloadLen = 0;
            for (int i = 0; i < 8; ++i) {
                payloadLen = (payloadLen << 8) | buffer_[2 + i];
            }
            headerLen = 10;
        }
        
        size_t maskLen = masked ? 4 : 0;
        size_t totalLen = headerLen + maskLen + payloadLen;
        
        if (buffer_.size() < totalLen) return;
        
        // Extract payload
        std::vector<uint8_t> payload(payloadLen);
        if (masked) {
            uint8_t mask[4];
            std::copy(buffer_.begin() + headerLen, 
                      buffer_.begin() + headerLen + 4, mask);
            for (size_t i = 0; i < payloadLen; ++i) {
                payload[i] = buffer_[headerLen + 4 + i] ^ mask[i % 4];
            }
        } else {
            std::copy(buffer_.begin() + headerLen, 
                      buffer_.begin() + headerLen + payloadLen, 
                      payload.begin());
        }
        
        buffer_.erase(buffer_.begin(), buffer_.begin() + totalLen);
        
        // Handle frame
        if (fin) {
            switch (opcode) {
                case WsOpcode::Text:
                case WsOpcode::Binary:
                    if (messageHandler_) {
                        messageHandler_(std::string(payload.begin(), payload.end()));
                    }
                    break;
                case WsOpcode::Ping:
                    // Send pong
                    {
                        auto pong = encodeFrame(WsOpcode::Pong, payload.data(), payload.size());
#ifdef _WIN32
                        ::send(fd_, reinterpret_cast<const char*>(pong.data()), 
                               static_cast<int>(pong.size()), 0);
#else
                        ::send(fd_, pong.data(), pong.size(), 0);
#endif
                    }
                    break;
                case WsOpcode::Close:
                    close();
                    break;
                default:
                    break;
            }
        }
    }
}

// WebSocketServer implementation

WebSocketServer::~WebSocketServer() {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& [id, conn] : connections_) {
        conn->close();
    }
    connections_.clear();
}

void WebSocketServer::broadcast(const std::string& message) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& [id, conn] : connections_) {
        if (conn->isOpen()) {
            conn->send(message);
        }
    }
}

size_t WebSocketServer::connectionCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return connections_.size();
}

std::string WebSocketServer::computeAcceptKey(const std::string& clientKey) {
    const std::string magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    std::string combined = clientKey + magic;
    
    SHA1 hasher;
    hasher.update(reinterpret_cast<const uint8_t*>(combined.data()), combined.size());
    auto digest = hasher.finalize();
    
    return base64Encode(std::vector<uint8_t>(digest.begin(), digest.end()));
}

bool WebSocketServer::isUpgradeRequest(const std::string& upgradeHeader, 
                                        const std::string& connectionHeader) {
    // Case-insensitive check
    std::string upgrade = upgradeHeader;
    std::string connection = connectionHeader;
    std::transform(upgrade.begin(), upgrade.end(), upgrade.begin(), ::tolower);
    std::transform(connection.begin(), connection.end(), connection.begin(), ::tolower);
    
    return upgrade.find("websocket") != std::string::npos &&
           connection.find("upgrade") != std::string::npos;
}

void WebSocketServer::addConnection(std::shared_ptr<WebSocketConnection> conn) {
    std::lock_guard<std::mutex> lock(mutex_);
    connections_[conn->getId()] = conn;
    
    if (connectionHandler_) {
        connectionHandler_(conn);
    }
}

void WebSocketServer::removeConnection(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    connections_.erase(id);
}

}  // namespace qfblotter
