# PF-Blotter Demo Video Script

## Duration: 2-3 minutes

---

## Scene 1: Introduction (15 seconds)
**[Show project title screen or GitHub repo]**

"This is PF-Blotter - a production-grade FIX 4.4 order gateway simulator that I built to demonstrate quant-dev plumbing skills. It features a C++20 backend with QuickFIX, real-time SSE streaming, and a React TypeScript frontend."

---

## Scene 2: Architecture Overview (20 seconds)
**[Show architecture diagram or code structure]**

"The system has three main components:
1. A FIX Acceptor gateway handling order flow
2. An HTTP server with SSE for real-time updates
3. A React dashboard for visualization

All orders flow through the FIX protocol and stream live to connected clients."

---

## Scene 3: Starting the System (20 seconds)
**[Show terminal - start backend]**

```bash
./qf_gateway config/acceptor.cfg 8080
```

"Here I'm starting the gateway. It listens on port 5001 for FIX connections and port 8080 for HTTP/SSE."

**[Show browser - navigate to dashboard]**

"The dashboard connects automatically via Server-Sent Events."

---

## Scene 4: Placing Orders (45 seconds)
**[Show dashboard order form]**

"Let me submit some orders through the UI."

**[Enter order: ORD001, AAPL, Buy, 500, 185.50]**

"This creates a NewOrderSingle message. Watch the order appear in the blotter..."

**[Point to status changing]**

"Notice the status transitions: NEW → PARTIAL → FILLED. The simulator executes partial fills realistically - large orders fill in chunks."

**[Enter 2-3 more orders with different symbols]**

"I'll add a few more orders to show multiple symbols..."

---

## Scene 5: Key Features (45 seconds)
**[Point to each component as you mention it]**

**Order Book:**
"Here's a simulated order book showing bid/ask depth with live price updates."

**Market Data Ticker:**
"The ticker bar shows real-time price ticks streaming at 4 updates per second."

**Performance Metrics:**
"Latency tracking shows order-to-ack time in microseconds - typically under 100μs."

**Position Tracker:**
"The position tracker calculates realized P&L per symbol automatically."

**[Cancel an order]**
"I can also cancel open orders directly from the blotter."

---

## Scene 6: Pre-Trade Risk (20 seconds)
**[Enter order with quantity > 10,000]**

"Pre-trade risk controls reject orders exceeding limits. Let me try a 15,000 share order..."

**[Show rejection]**

"Rejected - max quantity is 10,000. Same for notional limits over $1 million."

---

## Scene 7: Technical Highlights (20 seconds)
**[Show code or terminal]**

"Key technical points:
- FIX 4.4 protocol compliance
- Thread-safe order store with atomic operations  
- Microsecond latency tracking
- Append-only audit log for compliance
- Full Docker deployment with one command"

---

## Scene 8: Closing (15 seconds)
**[Show GitHub repo]**

"The full source code is on GitHub with CI/CD via GitHub Actions. Technologies: C++20, QuickFIX, React, TypeScript, TailwindCSS, and Docker.

Thanks for watching!"

---

## Recording Tips

1. **Screen resolution:** 1920x1080 or 2560x1440
2. **Clean desktop:** Hide unrelated windows/tabs
3. **Slow mouse movements:** Easier to follow
4. **Pause on key screens:** Give viewers time to read
5. **Use zoom:** QuickTime player or OBS can zoom into specific areas
6. **Audio:** Record in a quiet room or add voiceover later

## Suggested Tools

- **OBS Studio** - Free, powerful screen recording
- **QuickTime Player** - Built into macOS
- **Loom** - Easy sharing, auto-uploads

## Test Commands for Demo

```bash
# Start gateway
./build/build/Release/qf_gateway config/acceptor.cfg 8080

# Start sender (optional, for CLI demo)
./build/build/Release/qf_sender config/initiator.cfg

# Send order via CLI
nos A1 AAPL Buy 100 185.50
nos A2 GOOGL Sell 200 142.75
nos A3 MSFT Buy 150 415.00

# Cancel order
cancel A1 C1

# Trigger rejection (exceeds qty limit)
nos BIG1 AAPL Buy 15000 100.00
```
