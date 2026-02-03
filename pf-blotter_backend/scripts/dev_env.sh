#!/usr/bin/env bash
set -euo pipefail

SDKROOT=$(xcrun --show-sdk-path)
export SDKROOT
export CPLUS_INCLUDE_PATH="$SDKROOT/usr/include/c++/v1"

if ! command -v cmake >/dev/null 2>&1; then
  CMAKE_BIN=$(find "$HOME/.conan2" -path '*/CMake.app/Contents/bin/cmake' -maxdepth 10 2>/dev/null | head -n 1 || true)
  if [[ -n "${CMAKE_BIN}" ]]; then
    export PATH="$(dirname "$CMAKE_BIN"):$PATH"
  fi
fi

echo "SDKROOT=${SDKROOT}"
if command -v cmake >/dev/null 2>&1; then
  echo "cmake=$(command -v cmake)"
else
  echo "cmake not found on PATH"
fi
