#include "qfblotter/Logger.hpp"

#include <filesystem>

#include <spdlog/sinks/rotating_file_sink.h>
#include <spdlog/sinks/stdout_color_sinks.h>

namespace qfblotter {

std::shared_ptr<spdlog::logger> Logger::logger_;

void Logger::init(const std::string& name, const std::string& logfile) {
    if (logger_) {
        return;
    }

    std::filesystem::path path(logfile);
    if (!path.parent_path().empty()) {
        std::filesystem::create_directories(path.parent_path());
    }

    auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    auto file_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
        logfile, 5 * 1024 * 1024, 3, true);

    console_sink->set_pattern("[%H:%M:%S] [%^%l%$] %v");
    file_sink->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%l] %v");

    std::vector<spdlog::sink_ptr> sinks{console_sink, file_sink};
    logger_ = std::make_shared<spdlog::logger>(name, sinks.begin(), sinks.end());
    logger_->set_level(spdlog::level::info);
    logger_->flush_on(spdlog::level::info);
}

std::shared_ptr<spdlog::logger> Logger::get() {
    return logger_;
}

}  // namespace qfblotter
