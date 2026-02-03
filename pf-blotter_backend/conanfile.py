from conan import ConanFile
from conan.tools.cmake import cmake_layout


class QFBlotterConan(ConanFile):
    name = "qf_blotter"
    version = "0.1.0"
    package_type = "application"
    settings = "os", "arch", "compiler", "build_type"

    requires = (
        "quickfix/1.15.1",
        "cpp-httplib/0.15.3",
        "nlohmann_json/3.11.3",
        "spdlog/1.14.1",
        "gtest/1.14.0",
    )

    generators = (
        "CMakeToolchain",
        "CMakeDeps",
    )

    def layout(self):
        cmake_layout(self)
