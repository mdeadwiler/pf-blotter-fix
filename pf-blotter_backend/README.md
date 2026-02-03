# pf-blotter backend

QuickFIX/C++ order simulator gateway + sender with a minimal SSE HTTP service for a live blotter.

## Features (current)
- FIX 4.4 acceptor (gateway) and initiator (sender)
- Order acknowledgements and basic fills (simulated)
- In-memory order store and snapshot JSON
- SSE endpoint for live updates (`/events`)
- Structured logging (spdlog) to console + rotating file

## Prerequisites
- Python 3 + Conan 2
- Apple clang + Xcode Command Line Tools (macOS)

## Build (macOS)
```bash
./scripts/dev_env.sh

/Users/marquisedeadwiler/Library/Python/3.11/bin/conan install . --output-folder=build --build=missing -s compiler.cppstd=20
/Users/marquisedeadwiler/Library/Python/3.11/bin/conan install . --output-folder=build-debug --build=missing -s build_type=Debug -s compiler.cppstd=20

cmake --preset conan-release
cmake --build --preset conan-release

cmake --preset conan-debug
cmake --build --preset conan-debug
```

## Run
Terminal 1 (gateway):
```bash
./build/build/Release/qf_gateway config/acceptor.cfg 8080
```

Terminal 2 (sender):
```bash
./build/build/Release/qf_sender config/initiator.cfg
```

Sender CLI examples:
```text
nos A1 AAPL Buy 100 189.25
nos A2 MSFT Sell 50 421.10
cancel A1 C1
```

HTTP endpoints:
- `GET /health`
- `GET /snapshot`
- `GET /events` (SSE)

## Config
- FIX settings: `config/acceptor.cfg`, `config/initiator.cfg`
- FIX 4.4 dictionary: `fix/FIX44.xml`

## Notes
- The SSE stream publishes the full snapshot JSON on each update.
- `MarketSim` uses a deterministic random walk seeded at startup.
