# PF-Blotter: Design Document

## Overview

PF-Blotter is a production-grade FIX 4.4 order gateway simulator that demonstrates the core infrastructure skills required for quantitative trading systems development.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────┐
│  React Frontend │────▶│           C++ Backend (Gateway)          │
│   (Blotter UI)  │ SSE │                                          │
└─────────────────┘     │  ┌─────────────┐    ┌─────────────────┐  │
                        │  │ HTTP Server │    │  FIX Acceptor   │  │
                        │  │  (Port 8080)│    │   (Port 5001)   │  │
                        │  └──────┬──────┘    └────────┬────────┘  │
                        │         │                    │           │
                        │         ▼                    ▼           │
                        │  ┌─────────────────────────────────────┐ │
                        │  │          FixApplication             │ │
                        │  │  (Message Handler & Order Logic)    │ │
                        │  └─────────────────────────────────────┘ │
                        │         │                    │           │
                        │         ▼                    ▼           │
                        │  ┌────────────┐      ┌─────────────┐    │
                        │  │ OrderStore │      │  MarketSim  │    │
                        │  │ (State)    │      │ (Pricing)   │    │
                        │  └────────────┘      └─────────────┘    │
                        └──────────────────────────────────────────┘
```

## Design Decisions

### 1. Why C++ for the Backend?

**Decision:** Use C++20 with QuickFIX library

**Rationale:**
- FIX protocol is the industry standard for electronic trading
- C++ is the dominant language in HFT/quant infrastructure
- Demonstrates low-level systems programming skills
- QuickFIX is battle-tested (used by major exchanges)

**Trade-offs:**
- Longer build times vs. interpreted languages
- More complex deployment (static linking, dependencies)
- Worth it for demonstrating real quant-dev skills

### 2. Why SSE Instead of WebSockets?

**Decision:** Use Server-Sent Events for real-time updates

**Rationale:**
- SSE is simpler (HTTP-based, no protocol upgrade)
- Unidirectional streaming is sufficient for order updates
- Better compatibility with proxies and load balancers
- Native browser support without additional libraries
- Lower complexity than WebSocket connection management

**Trade-offs:**
- Can't push data from client (not needed here)
- HTTP/1.1 has 6-connection browser limit (acceptable for demo)

### 3. Why In-Memory State Instead of a Database?

**Decision:** Store orders in `std::unordered_map` with mutex protection

**Rationale:**
- Microsecond latency requirements (DB would add milliseconds)
- Real trading systems use in-memory state with async persistence
- Demonstrates understanding of low-latency constraints
- Simpler deployment (no database dependency)

**Trade-offs:**
- State lost on restart (acceptable for demo)
- Not horizontally scalable (single instance)
- Production would add async write-ahead log

### 4. Why Partial Fills?

**Decision:** Simulate realistic order execution with partial fills

**Rationale:**
- Real markets rarely fill large orders instantly
- Tests order state machine handling (NEW → PARTIAL → FILLED)
- Demonstrates understanding of FIX execution reports
- More interesting for demo purposes

### 5. Pre-Trade Risk Controls

**Decision:** Implement max quantity, max notional, and duplicate detection

**Rationale:**
- Every real trading system has pre-trade risk checks
- Prevents "fat finger" errors
- Required by regulations (MiFID II, SEC Rule 15c3-5)
- Demonstrates production mindset

**Implementation:**
```cpp
// Risk limits (configurable in production)
constexpr int MAX_ORDER_QTY = 10000;
constexpr double MAX_NOTIONAL = 1000000.0;  // $1M
```

### 6. Thread Safety Approach

**Decision:** Use mutex-per-component rather than lock-free structures

**Rationale:**
- Simpler to reason about and maintain
- Sufficient for demo throughput requirements
- Lock-free would be premature optimization
- Real systems profile first, then optimize hot paths

**Components with mutex protection:**
- `OrderStore` - order state access
- `MarketSim` - price generation (RNG state)
- `SseBroker` - SSE subscriber management

### 7. Why React + TypeScript Frontend?

**Decision:** React 18 with TypeScript and TailwindCSS

**Rationale:**
- Industry standard for financial dashboards
- Type safety prevents runtime errors
- Component model fits blotter UI well
- TailwindCSS enables rapid UI development

## FIX Protocol Implementation

### Supported Messages

| Message Type | Tag 35 | Direction | Purpose |
|-------------|--------|-----------|---------|
| NewOrderSingle | D | Client → Gateway | Submit new order |
| OrderCancelRequest | F | Client → Gateway | Cancel existing order |
| ExecutionReport | 8 | Gateway → Client | Order status updates |
| OrderCancelReject | 9 | Gateway → Client | Cancel rejection |

### Order State Machine

```
                    ┌──────────┐
                    │   NEW    │
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ REJECTED │  │ PARTIAL  │  │  FILLED  │
    └──────────┘  └────┬─────┘  └──────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ CANCELED │ │  FILLED  │ │ (more    │
    └──────────┘ └──────────┘ │ partials)│
                              └──────────┘
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Order submission latency | ~50-200 μs | In-memory processing |
| SSE update latency | ~1-5 ms | Network dependent |
| Market data tick rate | 4 Hz | Configurable |
| Max orders (demo) | ~100K | Memory limited |

## Security Considerations

### What's Implemented (Demo)
- CORS headers for browser security
- Input validation on all endpoints
- Mock authentication (localStorage)

### What Production Would Need
- TLS/mTLS for FIX connections
- Real authentication (OAuth2/OIDC)
- Rate limiting
- IP whitelisting
- Audit logging to tamper-proof storage

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Render                           │
│                                                         │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │ Static Site     │      │ Web Service             │  │
│  │ (Frontend)      │─────▶│ (Backend Container)     │  │
│  │ React SPA       │ API  │ - C++ Gateway           │  │
│  │ CDN-cached      │      │ - FIX Acceptor          │  │
│  └─────────────────┘      │ - SSE Streaming         │  │
│                           └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Future Enhancements

If this were a real product, next steps would be:

1. **Persistence** - Write-ahead log for crash recovery
2. **Clustering** - State replication for HA
3. **Market Data** - Real exchange feeds (IEX, Polygon)
4. **Order Types** - Market, stop-loss, IOC, FOK
5. **FIX 5.0** - FIXT transport layer
6. **Monitoring** - Prometheus metrics, Grafana dashboards

## References

- [FIX Protocol Specification](https://www.fixtrading.org/standards/)
- [QuickFIX Documentation](https://quickfixengine.org/)
- [SEC Rule 15c3-5 (Risk Controls)](https://www.sec.gov/rules/final/2010/34-63241.pdf)
