#pragma once

#include <memory>
#include <string>

#include <spdlog/logger.h>

namespace qfblotter {

class Logger {
public:
    static void init(const std::string& name, const std::string& logfile);
    static std::shared_ptr<spdlog::logger> get();

private:
    static std::shared_ptr<spdlog::logger> logger_;
};

}  // namespace qfblotter
