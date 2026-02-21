cmake_minimum_required(VERSION 3.21)
project(digital_twin_backend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(Boost REQUIRED COMPONENTS system)
find_package(Eigen3 CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)

add_executable(twin_server
    src/main.cpp
    src/PhysicsEngine.cpp
)

target_include_directories(twin_server PRIVATE src)

target_link_libraries(twin_server PRIVATE
    Boost::system
    Eigen3::Eigen
    nlohmann_json::nlohmann_json
)

if(MSVC)
    target_compile_options(twin_server PRIVATE /W4 /permissive- /bigobj)
    target_compile_definitions(twin_server PRIVATE
        _WIN32_WINNT=0x0A00
        NOMINMAX
        WIN32_LEAN_AND_MEAN
    )
else()
    target_compile_options(twin_server PRIVATE -Wall -Wextra -Wpedantic)
    find_package(Threads REQUIRED)
    target_link_libraries(twin_server PRIVATE Threads::Threads)
endif()
