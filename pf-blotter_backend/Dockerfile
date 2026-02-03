# Multi-stage build for C++ QuickFIX backend
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install CMake 3.28 (Ubuntu 22.04 has old CMake that doesn't support preset version 6)
RUN wget -q https://github.com/Kitware/CMake/releases/download/v3.28.3/cmake-3.28.3-linux-x86_64.tar.gz \
    && tar -xzf cmake-3.28.3-linux-x86_64.tar.gz -C /opt \
    && ln -s /opt/cmake-3.28.3-linux-x86_64/bin/cmake /usr/local/bin/cmake \
    && ln -s /opt/cmake-3.28.3-linux-x86_64/bin/ctest /usr/local/bin/ctest \
    && rm cmake-3.28.3-linux-x86_64.tar.gz

# Install Conan
RUN pip3 install conan

# Set up Conan profile
RUN conan profile detect

WORKDIR /app

# Copy dependency files first for caching
COPY conanfile.py CMakeLists.txt ./

# Install dependencies (generates CMakePresets.json)
RUN conan install . --build=missing -of=build -s build_type=Release

# Copy source code
COPY include/ include/
COPY src/ src/
COPY tests/ tests/
COPY config/ config/

# Build
RUN cmake --preset conan-release
RUN cmake --build --preset conan-release

# Runtime stage
FROM ubuntu:22.04 AS runtime

RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built binaries
COPY --from=builder /app/build/build/Release/qf_gateway /app/
COPY --from=builder /app/build/build/Release/qf_sender /app/

# Copy config files and FIX data dictionary
COPY config/ /app/config/
COPY fix/ /app/fix/

# Create log directory
RUN mkdir -p /app/config/log /app/config/store

# Expose ports
EXPOSE 5001 8080

# Default command
CMD ["./qf_gateway", "config/acceptor.cfg", "8080"]
