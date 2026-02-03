#pragma once

#include <string>

#include <nlohmann/json.hpp>

namespace qfblotter {
using Json = nlohmann::json;

inline std::string dump(const Json& j, int indent = 0) {
    return j.dump(indent);
}
}  // namespace qfblotter
