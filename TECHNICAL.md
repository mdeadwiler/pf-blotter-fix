# Technical Documentation

A deep-dive into the architecture, implementation decisions, and engineering practices behind QuantBlotterSim.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Why I Built This](#why-i-built-this)
3. [Architecture](#architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Quantitative Features](#quantitative-features)
7. [Security & Reliability](#security--reliability)
8. [What I Learned](#what-i-learned)
9. [Interview Talking Points](#interview-talking-points)

---

## Project Overview

### What It Is

QuantBlotterSim is a full-stack trading system simulator that implements:

1. **FIX Protocol Engine** — The backbone of electronic trading on Wall Street
2. **Real-Time Order Management** — Submit, amend, cancel orders with live execution feedback
3. **Algorithmic Trading Strategies** — VWAP, TWAP, mean reversion, momentum, pairs trading
4. **Quantitative Analytics** — Portfolio optimization, options pricing, Monte Carlo risk simulation

### What It Demonstrates

| Skill Area | Implementation |
|------------|----------------|
| **Systems Programming** | C++20, multithreading, memory management, protocol implementation |
| **Distributed Systems** | Real-time streaming (WebSocket/SSE), state synchronization, reconnection handling |
| **Quantitative Finance** | Black-Scholes, Kelly Criterion, VaR/CVaR, Sharpe ratio, portfolio optimization |
| **Full-Stack Development** | React, TypeScript, REST APIs, event-driven architecture |
| **Production Engineering** | Rate limiting, input validation, error handling, Docker deployment |

---

## Why I Built This

Most quant portfolios show the same things: a Jupyter notebook with backtesting, maybe some data analysis. I wanted to demonstrate something different — the **infrastructure** that makes trading systems work.

In real trading firms, quants don't just write strategies. They need to understand:

- How orders flow from idea to execution
- What happens when systems fail mid-trade
- Why latency matters and how to measure it
- How to handle concurrent access to shared state

This project shows I can build the plumbing, not just the math.

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Trading    │  │    Algo     │  │  Backtest   │  │  Analytics  │ │
│  │    Tab      │  │    Tab      │  │    Tab      │  │    Tab      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │         │
│         └────────────────┴────────────────┴────────────────┘         │
│                                   │                                   │
│                    ┌──────────────┴──────────────┐                   │
│                    │    useWebSocket / useSSE    │                   │
│                    │    (exponential backoff)    │                   │
│                    └──────────────┬──────────────┘                   │
└───────────────────────────────────┼───────────────────────────────────┘
                                    │
                          HTTP / WebSocket / SSE
                                    │
┌───────────────────────────────────┼───────────────────────────────────┐
│                         Backend (C++20)                               │
│                                   │                                   │
│    ┌──────────────────────────────┴──────────────────────────────┐   │
│    │                      HttpServer                              │   │
│    │  • Rate Limiting (60 req/min)                                │   │
│    │  • Input Validation                                          │   │
│    │  • CORS (environment-based)                                  │   │
│    └──────────────────────────────┬──────────────────────────────┘   │
│                                   │                                   │
│    ┌──────────────────────────────┴──────────────────────────────┐   │
│    │                    FixApplication                            │   │
│    │  • FIX 4.4 Protocol (QuickFIX)                              │   │
│    │  • NewOrderSingle, ExecutionReport, Cancel, Amend           │   │
│    └──────────────────────────────┬──────────────────────────────┘   │
│                                   │                                   │
│    ┌─────────────┐  ┌─────────────┴─────────────┐  ┌─────────────┐   │
│    │  OrderStore │  │       FillSimulator       │  │ Persistence │   │
│    │  (shared_   │  │  (partial fills, prices)  │  │ (JSON file) │   │
│    │   mutex)    │  │                           │  │             │   │
│    └─────────────┘  └───────────────────────────┘  └─────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Order Submission**: User clicks "Submit" → POST /order → Input validation → Rate limit check → FIX NewOrderSingle → OrderStore
2. **Execution**: FillSimulator polls open orders → Generates partial/full fills → Sends FIX ExecutionReport → SSE/WebSocket broadcast
3. **Real-Time Updates**: OrderStore change → JSON serialization → Broadcast to all connected clients
4. **Persistence**: Every state change → Write to orders.json → Recoverable on restart

---

## Backend Implementation

### FIX Protocol (FixApplication.cpp)

The Financial Information eXchange protocol is the industry standard for order routing. I implemented:

```cpp
// Message types handled
- NewOrderSingle (D)        // New order request
- OrderCancelRequest (F)    // Cancel request
- OrderCancelReplaceRequest (G)  // Amend request
- ExecutionReport (8)       // Fill/reject notification
```

**Why FIX matters**: Every major exchange (NYSE, NASDAQ, CME) and broker uses FIX. Understanding it demonstrates real-world trading system knowledge.

### Thread Safety (OrderStore.cpp)

The order store uses a **reader-writer lock** (`std::shared_mutex`):

```cpp
// Multiple readers can access simultaneously
std::shared_lock<std::shared_mutex> lock(mutex_);  // get(), exists(), snapshot()

// Writers get exclusive access
std::unique_lock<std::shared_mutex> lock(mutex_);  // upsert(), updateStatus()
```

**Why this matters**: Trading systems are read-heavy (many clients requesting snapshots) but write-light (fewer order submissions). Reader-writer locks maximize throughput.

### WebSocket Implementation (WebSocket.cpp)

Hand-rolled RFC 6455 WebSocket with security hardening:

```cpp
// Protection against malicious clients
constexpr size_t MAX_BUFFER_SIZE = 1024 * 1024;  // 1MB buffer limit
constexpr size_t MAX_PAYLOAD_SIZE = 64 * 1024;   // 64KB per frame

// Graceful close with proper codes
close(1009, "Message too large");  // Per RFC 6455
close(1002, "Protocol error");     // Integer overflow attempt
```

### Rate Limiting (HttpServer.cpp)

Token bucket algorithm with automatic cleanup:

```cpp
class RateLimiter {
    // Background thread evicts stale IPs every 60s
    // Prevents memory exhaustion from tracking too many clients
    std::thread cleanupThread_;
    
    bool allow(const std::string& ip) {
        // Sliding window: 60 orders per minute per IP
    }
};
```

---

## Frontend Implementation

### Real-Time Hooks

**useWebSocket.ts** — Resilient connection management:

```typescript
// Exponential backoff with jitter prevents thundering herd
function calculateBackoff(attempt: number): number {
  const exponential = Math.min(30000, 1000 * Math.pow(2, attempt));
  const jitter = exponential * 0.2 * Math.random();
  return exponential + jitter;
}

// Refs prevent stale closures in async callbacks
const statusRef = useRef(status);
useEffect(() => { statusRef.current = status; }, [status]);
```

**Why jitter matters**: If 1000 clients disconnect and all use pure exponential backoff (2s, 4s, 8s...), they'll all retry at the exact same times, potentially crashing the server. Jitter spreads the load.

### Web Workers (Non-Blocking Calculations)

Heavy computations run off the main thread:

```typescript
// Monte Carlo VaR - 10,000 GBM paths
const worker = new Worker(
  new URL('./workers/monteCarloWorker.ts', import.meta.url),
  { type: 'module' }
);

worker.postMessage(config);
worker.onmessage = (e) => {
  if (e.data.type === 'progress') setProgress(e.data.progress);
  if (e.data.type === 'result') setResult(e.data.result);
};
```

**Why this matters**: Without workers, running 10,000 simulations would freeze the UI for seconds. Web Workers keep the interface responsive.

### Error Boundaries

Graceful failure handling at the component level:

```tsx
<ErrorBoundary>
  <MonteCarloVaR />
</ErrorBoundary>
```

If one analytics tool crashes, the rest of the dashboard keeps working.

---

## Quantitative Features

### Black-Scholes Options Pricing

Full implementation with all five Greeks:

```typescript
// Price calculation
function blackScholes(S, K, T, r, sigma, isCall): number {
  const d1 = (Math.log(S/K) + (r + sigma²/2)*T) / (sigma*√T);
  const d2 = d1 - sigma*√T;
  // ... N(d1), N(d2) calculations
}

// Greeks
Delta = N(d1)                    // Price sensitivity
Gamma = N'(d1) / (S·σ·√T)        // Delta sensitivity
Theta = -(S·N'(d1)·σ)/(2·√T)     // Time decay
Vega = S·N'(d1)·√T               // Vol sensitivity
Rho = K·T·e^(-rT)·N(d2)          // Rate sensitivity
```

### Implied Volatility Solver

Newton-Raphson iteration to find IV from market price:

```typescript
function impliedVolatility(targetPrice, S, K, T, r, isCall): number {
  let sigma = 0.3;  // Initial guess
  for (let i = 0; i < 100; i++) {
    const price = blackScholes(S, K, T, r, sigma, isCall);
    const vega = S * normalPDF(d1) * Math.sqrt(T);  // Raw derivative
    
    if (Math.abs(price - targetPrice) < 0.0001) break;
    sigma = sigma - (price - targetPrice) / vega;
  }
  return sigma;
}
```

### Monte Carlo VaR

Geometric Brownian Motion simulation:

```typescript
// GBM: S(t) = S(0) * exp((μ - σ²/2)t + σ√t·Z)
for (let sim = 0; sim < 10000; sim++) {
  let value = portfolioValue;
  for (let day = 0; day < horizon; day++) {
    const Z = randomNormal();  // Box-Muller transform
    value *= Math.exp((mu - 0.5*sigma²) + sigma*Z);
  }
  finalValues.push(value);
}

// VaR at 95% confidence
const sortedValues = finalValues.sort((a,b) => a-b);
const VaR = portfolioValue - sortedValues[Math.floor(0.05 * 10000)];

// CVaR (Expected Shortfall) - average of tail
const CVaR = portfolioValue - average(sortedValues.slice(0, 500));
```

### Portfolio Optimization

Markowitz mean-variance with Monte Carlo sampling:

```typescript
// Generate random portfolios on efficient frontier
for (let i = 0; i < 10000; i++) {
  const weights = generateRandomWeights(numAssets);
  const ret = dot(weights, expectedReturns);
  const vol = sqrt(quadraticForm(weights, covMatrix));
  const sharpe = (ret - riskFreeRate) / vol;
  
  if (sharpe > maxSharpe) {
    maxSharpe = sharpe;
    optimalWeights = weights;
  }
}
```

---

## Security & Reliability

### Input Validation (Backend)

Every API endpoint validates input before processing:

```cpp
bool isValidSymbol(const std::string& s) {
    if (s.empty() || s.size() > 10) return false;
    return std::all_of(s.begin(), s.end(), [](char c) {
        return std::isalnum(c) || c == '.' || c == '-';
    });
}

bool isValidQuantity(int qty) {
    return qty > 0 && qty <= 10000;  // Pre-trade risk control
}

bool isValidPrice(double price) {
    return std::isfinite(price) && price > 0 && price < 1000000;
}
```

### Request Size Limits

Protection against denial-of-service:

```cpp
constexpr size_t MAX_REQUEST_BODY_SIZE = 64 * 1024;  // 64KB

if (req.body.size() > MAX_REQUEST_BODY_SIZE) {
    res.status = 413;  // Payload Too Large
    return;
}
```

### CORS Configuration

Environment-based origin restriction:

```cpp
std::string getAllowedOrigins() {
    const char* env = std::getenv("CORS_ALLOWED_ORIGINS");
    if (env) return env;
    return "http://localhost:5173, https://quantblottersim.onrender.com";
}
```

---

## What I Learned

### Technical Skills

1. **C++ Memory Management** — Working with QuickFIX required understanding RAII, smart pointers, and avoiding memory leaks in long-running servers.

2. **Protocol Implementation** — Implementing WebSocket from scratch taught me framing, masking, and why standards documents exist.

3. **Concurrency Patterns** — Reader-writer locks, atomic operations, and avoiding deadlocks in multi-threaded code.

4. **Financial Mathematics** — Black-Scholes derivation, why volatility smiles exist, and the assumptions behind VaR.

### Engineering Practices

1. **Defensive Programming** — Always validate input. Always handle errors. Never trust the client.

2. **Observability** — Structured logging (spdlog), latency tracking (p99), health endpoints.

3. **Graceful Degradation** — WebSocket fails? Fall back to SSE. Worker fails? Show error boundary.

---

## Interview Talking Points

### "Walk me through the architecture"

> "The backend is a C++20 FIX protocol engine. FIX is the industry standard for electronic trading — every major exchange uses it. The frontend connects via WebSocket for low-latency updates, with SSE as a fallback. Orders flow through rate limiting and validation, then into the FIX engine which manages execution simulation. The order store uses reader-writer locks so multiple clients can read snapshots without blocking each other."

### "What's the hardest bug you fixed?"

> "Stale closures in React hooks. The WebSocket reconnection logic was reading old state because the callback captured a stale reference. I fixed it by using useRef to always access current state. It's a subtle React pitfall that causes intermittent bugs — hard to reproduce, easy to fix once you understand it."

### "How do you handle concurrent access?"

> "Reader-writer locks. The order store has many clients reading (snapshot requests, live feeds) but few writers (new orders, fills). With a regular mutex, readers would block each other unnecessarily. shared_mutex lets multiple readers proceed simultaneously while ensuring writers get exclusive access."

### "Why did you implement WebSocket from scratch?"

> "To understand the protocol deeply. It forced me to read RFC 6455, implement the handshake, handle framing and masking, and think about security (buffer limits, frame size validation). Now when I debug WebSocket issues in production, I understand exactly what's happening at the wire level."

### "What would you add with more time?"

> "Three things: (1) Replace the in-memory order store with Redis for horizontal scaling. (2) Add OpenTelemetry tracing to track order latency end-to-end. (3) Implement a matching engine so the simulator could handle multiple users trading against each other."

---

## Running the Project

See [README.md](./README.md) for setup instructions.

---

## Contact

Built by **Marquise Deadwiler**

[![GitHub](https://img.shields.io/badge/GitHub-mdeadwiler-181717?style=flat&logo=github)](https://github.com/mdeadwiler)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-marquisedeadwiler-0A66C2?style=flat&logo=linkedin)](https://www.linkedin.com/in/marquisedeadwiler/)
