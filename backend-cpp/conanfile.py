from conan import ConanFile
from conan.tools.cmake import cmake_layout, CMakeDeps, CMakeToolchain


class DigitalTwinBackend(ConanFile):
    name = "digital-twin-backend"
    version = "1.0.0"
    settings = "os", "compiler", "build_type", "arch"

    def requirements(self):
        self.requires("boost/1.85.0")
        self.requires("eigen/3.4.0")
        self.requires("nlohmann_json/3.11.3")

    def layout(self):
        cmake_layout(self)

    def generate(self):
        deps = CMakeDeps(self)
        deps.generate()
        tc = CMakeToolchain(self)
        tc.generate()
