# QuantBlotterSim

A production-grade FIX 4.4 order gateway simulator demonstrating quant-dev infrastructure skills.

## Live Demo

**Try it now:** [https://quantblottersim.onrender.com](https://quantblottersim.onrender.com)

> Submit orders, watch real-time fills, track P&L—all powered by the same FIX protocol Wall Street uses. No signup required to explore.

---

## Features

### Trading Engine
- **FIX 4.4 Protocol** - Full NewOrderSingle, OrderCancelRequest, OrderCancelReplaceRequest, ExecutionReport
- **Market & Limit Orders** - Market orders fill instantly at current price
- **Order Amendment** - Modify price/quantity of open orders (cancel/replace)
- **Partial Fills** - Realistic execution simulation with chunked fills
- **Pre-Trade Risk Controls** - Max quantity (10,000), max notional ($1M), duplicate detection
- **Rate Limiting** - 60 orders/min, 30 cancels/min per IP (DOS protection)
- **Persistence Layer** - Orders saved to JSON, recovered on restart

### Algorithmic Trading
- **Mean Reversion Strategy** - Buys below SMA, sells above SMA
- **Momentum Strategy** - Follows trend direction
- **Configurable Parameters** - Symbol, order size, threshold %
- **Real-Time Execution** - Automated order submission

### Real-Time Data
- **WebSocket Support** - RFC 6455 implementation for sub-millisecond latency
- **SSE Fallback** - Graceful degradation to Server-Sent Events
- **Order Book Visualization** - Simulated bid/ask depth chart
- **Market Data Feed** - Live price ticks streaming at 4Hz
- **Realistic Prices** - 35+ tickers with approximate real-world starting prices

### Backtesting Engine
- **Strategy Simulation** - Run algos against synthetic historical data
- **Key Metrics** - Sharpe ratio, max drawdown, win rate, profit factor
- **Equity Curve** - Visual P&L progression over time
- **Configurable Parameters** - Capital, volatility, periods

### Analytics
- **Performance Metrics** - Microsecond latency tracking (avg, min, max, p99)
- **Position Tracking** - Real-time P&L calculation per symbol
- **Audit Log** - Append-only compliance logging
- **Algo Statistics** - Trade count, position, signal history

### UX Polish
- **Toast Notifications** - Visual feedback on order fills/rejects
- **Sound Effects** - Audio cues for fills, rejects, cancels (toggle with S key)
- **Dark/Light Theme** - Accessibility-friendly themes (toggle with T key)
- **Keyboard Shortcuts** - N=new order, Esc=unfocus, S=sound, T=theme
- **Mobile Responsive** - Works on phones and tablets

## Tech Stack

### Backend (C++20)
- QuickFIX 1.15.1 - FIX protocol engine
- cpp-httplib - HTTP server with SSE support
- nlohmann/json - JSON serialization
- spdlog - Structured logging
- GTest - Unit testing

### Frontend (React)
- React 18 + TypeScript
- Vite - Build tooling
- TailwindCSS - Styling
- Server-Sent Events - Real-time updates

### DevOps
- Docker + Docker Compose
- GitHub Actions CI/CD
- Conan 2 - C++ package management
- CMake - Build system

## Quick Start

### Local Development

**Backend:**
```bash
cd pf-blotter_backend
conan install . --build=missing -of=build -s build_type=Release
cmake --preset conan-release
cmake --build --preset conan-release

# Start gateway
./build/build/Release/qf_gateway config/acceptor.cfg 8080
```

**Frontend:**
```bash
cd pf-blotter_frontend
npm install
npm run dev
```

Open http://localhost:5173

### Docker Deployment

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

## Usage

### Dashboard
1. Sign in (mock auth)
2. Use the order form to submit orders
3. Watch real-time updates in the blotter
4. Click "Cancel" on open orders to cancel

### CLI Sender (Optional)
```bash
./build/build/Release/qf_sender config/initiator.cfg

# Commands:
nos <clOrdId> <symbol> <Buy|Sell> <qty> <price>
cancel <origClOrdId> <cancelClOrdId>
quit
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/snapshot` | GET | Current order state |
| `/events` | GET | SSE stream for order updates |
| `/marketdata` | GET | SSE stream for price ticks |
| `/orderbook?symbol=` | GET | Order book for symbol |
| `/stats` | GET | Performance statistics |
| `/market-hours` | GET | Check if market is open (simulated) |
| `/order` | POST | Submit new order (Limit or Market) |
| `/cancel` | POST | Cancel order |
| `/amend` | POST | Amend order price/quantity |

## Project Structure

```
PubFix/
├── pf-blotter_backend/
│   ├── include/qfblotter/    # Headers
│   ├── src/                  # Implementation
│   ├── tests/                # Unit tests
│   ├── config/               # FIX & logging config
│   └── Dockerfile
├── pf-blotter_frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   └── utils/            # Utilities
│   └── Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Testing

**Backend:**
```bash
cd pf-blotter_backend
ctest --preset conan-release --output-on-failure
```

**Frontend:**
```bash
cd pf-blotter_frontend
npm run build  # Type checking
```

## License

MIT
