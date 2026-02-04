cmake_minimum_required(VERSION 3.21)
project(qf_blotter LANGUAGES CXX)

# macOS: Ensure SDK is found for C++ standard library headers
if(APPLE AND NOT CMAKE_OSX_SYSROOT)
    execute_process(
        COMMAND xcrun --show-sdk-path
        OUTPUT_VARIABLE CMAKE_OSX_SYSROOT
        OUTPUT_STRIP_TRAILING_WHITESPACE
    )
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(quickfix CONFIG REQUIRED)
find_package(httplib CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(spdlog CONFIG REQUIRED)

add_library(qf_core
    src/Logger.cpp
    src/FixApplication.cpp
    src/OrderStore.cpp
    src/MarketSim.cpp
    src/HttpServer.cpp
    src/AuditLog.cpp
    src/Persistence.cpp
    src/WebSocket.cpp
)

target_include_directories(qf_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

set(_qf_targets quickfix::quickfix QuickFIX::quickfix QuickFIX::QuickFIX)
foreach(_t IN LISTS _qf_targets)
    if(TARGET ${_t})
        target_link_libraries(qf_core PUBLIC ${_t})
        break()
    endif()
endforeach()

if(NOT (TARGET quickfix::quickfix OR TARGET QuickFIX::quickfix OR TARGET QuickFIX::QuickFIX))
    message(FATAL_ERROR "QuickFIX CMake target not found. Check Conan package targets.")
endif()

if(TARGET httplib::httplib)
    target_link_libraries(qf_core PUBLIC httplib::httplib)
endif()

if(TARGET nlohmann_json::nlohmann_json)
    target_link_libraries(qf_core PUBLIC nlohmann_json::nlohmann_json)
endif()

if(TARGET spdlog::spdlog)
    target_link_libraries(qf_core PUBLIC spdlog::spdlog)
endif()

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(qf_core PRIVATE -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wno-overloaded-virtual)
endif()

if(APPLE)
    target_compile_definitions(qf_core PUBLIC _LIBCPP_ENABLE_CXX17_REMOVED_AUTO_PTR)
endif()

add_executable(qf_gateway
    src/gateway_main.cpp
)

add_executable(qf_sender
    src/sender_main.cpp
)

target_link_libraries(qf_gateway PRIVATE qf_core)
target_link_libraries(qf_sender PRIVATE qf_core)

# Unit Tests
option(BUILD_TESTS "Build unit tests" ON)
if(BUILD_TESTS)
    enable_testing()
    find_package(GTest CONFIG REQUIRED)
    
    add_executable(qf_tests
        tests/test_order_store.cpp
        tests/test_market_sim.cpp
    )
    
    target_link_libraries(qf_tests PRIVATE
        qf_core
        GTest::gtest
        GTest::gtest_main
    )
    
    include(GoogleTest)
    gtest_discover_tests(qf_tests)
endif()
