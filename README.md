# QuantBlotterSim

A production-grade FIX 4.4 order management system simulator demonstrating quantitative development and trading infrastructure skills.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-quantblottersim.onrender.com-00d4ff?style=for-the-badge)](https://quantblottersim.onrender.com)
[![GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/mdeadwiler/pf-blotter-fix)

---

## Overview

This project implements a complete trading system simulator from the ground up:

- **Backend**: C++20 FIX protocol engine with real-time WebSocket/SSE streaming
- **Frontend**: React dashboard with algorithmic trading, backtesting, and quantitative analytics
- **Infrastructure**: Docker deployment, CI/CD, rate limiting, persistence

> **Note**: This is an educational simulator. All prices are synthetic (random walk), no real money is involved, and it is not connected to real markets.

For a detailed technical breakdown of the implementation, see [TECHNICAL.md](./TECHNICAL.md).

---

## Quick Links

| Resource | Link |
|----------|------|
| **Live Demo** | [quantblottersim.onrender.com](https://quantblottersim.onrender.com) |
| **Technical Documentation** | [TECHNICAL.md](./TECHNICAL.md) |
| **API Reference** | [API Endpoints](#api-endpoints) |
| **Source Code** | [GitHub Repository](https://github.com/mdeadwiler/pf-blotter-fix) |

---

## Features

### Trading Engine
- FIX 4.4 protocol (NewOrderSingle, ExecutionReport, OrderCancelRequest, OrderCancelReplaceRequest)
- Market & Limit orders with partial fill simulation
- Order amendment (cancel/replace)
- Pre-trade risk controls (max quantity, max notional, duplicate detection)
- Rate limiting (60 orders/min per IP)
- File-based persistence with crash recovery

### Algorithmic Trading
- Execution algorithms: VWAP, TWAP
- Technical strategies: Mean Reversion, Momentum, Bollinger Bands, RSI, Breakout
- Statistical arbitrage: Pairs Trading with z-score signals
- Configurable position limits, stop-loss, take-profit

### Quantitative Analytics
- **Portfolio Optimizer**: Markowitz mean-variance with efficient frontier visualization
- **Options Pricer**: Black-Scholes model with full Greeks (Δ, Γ, Θ, ν, ρ) and IV solver
- **Monte Carlo VaR**: 10,000-path GBM simulation for Value at Risk & Expected Shortfall
- **Kelly Criterion**: Optimal position sizing with growth rate curves

### Real-Time Data
- WebSocket (RFC 6455) for low-latency updates
- SSE fallback for browser compatibility
- Live order book visualization
- Market data streaming at 4Hz

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | C++20, QuickFIX 1.15.1, cpp-httplib, nlohmann/json, spdlog |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Web Workers |
| **Infrastructure** | Docker, GitHub Actions, Conan 2, CMake |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose (recommended)
- Or: Node.js 18+, Python 3, Conan 2, CMake, C++20 compiler

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/mdeadwiler/pf-blotter-fix.git
cd pf-blotter-fix
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

### Option 2: Local Development

**Backend:**
```bash
cd pf-blotter_backend
conan install . --build=missing -of=build -s build_type=Release
cmake --preset conan-release
cmake --build --preset conan-release
./build/build/Release/qf_gateway config/acceptor.cfg 8080
```

**Frontend:**
```bash
cd pf-blotter_frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/snapshot` | GET | Current order state (JSON) |
| `/events` | GET | SSE stream for order updates |
| `/marketdata` | GET | SSE stream for price ticks |
| `/orderbook?symbol=` | GET | Order book depth for symbol |
| `/stats` | GET | Performance statistics |
| `/market-hours` | GET | Simulated market hours check |
| `/order` | POST | Submit new order |
| `/cancel` | POST | Cancel order |
| `/amend` | POST | Amend order price/quantity |

---

## Project Structure

```
├── pf-blotter_backend/
│   ├── include/qfblotter/    # C++ headers
│   ├── src/                  # Implementation
│   ├── tests/                # Unit tests (GTest)
│   ├── config/               # FIX protocol config
│   └── Dockerfile
├── pf-blotter_frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks (WebSocket, SSE)
│   │   └── workers/          # Web Workers (Monte Carlo, Backtest)
│   └── Dockerfile
├── docker-compose.yml
├── TECHNICAL.md              # Detailed technical documentation
└── .github/workflows/ci.yml  # CI/CD pipeline
```

---

## Disclaimer

**This is an educational project.**

- All market data is **simulated** using random walk algorithms
- **No real money** is involved
- **Not connected to real exchanges** or market data feeds
- Strategy results are for **demonstration purposes only**
- This is **not financial advice**

---

## License

MIT

---

## Author

Built by **Marquise Deadwiler**

[![GitHub](https://img.shields.io/badge/GitHub-mdeadwiler-181717?style=flat&logo=github)](https://github.com/mdeadwiler)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-marquisedeadwiler-0A66C2?style=flat&logo=linkedin)](https://www.linkedin.com/in/marquisedeadwiler/)
