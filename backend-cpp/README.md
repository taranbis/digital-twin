# Digital Twin Backend (C++20)

Real-time physics engine for a rotating automotive component, broadcasting state at 100 Hz over WebSockets using Boost.Beast.

## Prerequisites

- C++ development environment
- **CMake 3.21+** (included with VS2022)
- **Conan 2** package manager ([https://conan.io](https://conan.io))
- (optional) **Visual Studio 2022** with C++ Desktop workload

## Conan Setup (one-time)

```powershell
pip install conan
conan profile detect
```

`conan profile detect` auto-detects your MSVC compiler. Verify with:

```powershell
conan profile show
```

You should see `compiler=msvc`, `compiler.version=...`, `os=Windows`.

## Install Dependencies

From the `backend-cpp/` directory, install for both Debug and Release:

```powershell
conan install . --build=missing -s build_type=Debug
conan install . --build=missing -s build_type=Release
```

First run takes a few minutes as Conan builds Boost from source.

This generates `CMakeUserPresets.json` with `conan-debug` and `conan-release` presets.

## Build (command line)

```powershell
cmake --preset conan-release
cmake --build --preset conan-release
```

Or for Debug:

```powershell
cmake --preset conan-debug
cmake --build --preset conan-debug
```

## Build (VS Code)

1. Install the **CMake Tools** extension
2. Open the `backend-cpp/` folder in VS Code
3. `Ctrl+Shift+P` -> "CMake: Select Configure Preset" -> pick `conan-debug` or `conan-release`
4. `Ctrl+Shift+P` -> "CMake: Build"
5. To debug: `Ctrl+Shift+P` -> "CMake: Debug" (or press `Ctrl+F5`)

The `conan-debug` preset builds with full debug symbols so breakpoints and stepping work out of the box.

## Run

```powershell
# Release
.\build\Release\twin_server.exe

# Debug
.\build\Debug\twin_server.exe
```

Output:
```
=== Digital Twin Backend ===
WebSocket server listening on ws://localhost:3001
Health check: http://localhost:3001/health
[stats] clients=0 broadcast_rate=100 Hz rpm=1200.00
```

## Protocol

### Server -> Client (100 Hz)
```json
{
  "type": "state",
  "payload": {
    "rpm": 3000.0,
    "angle_rad": 1.5708,
    "stress_pa": 49403.7,
    "stress_factor": 0.141,
    "piston_force_n": 486.4,
    "rod_force_n": 512.1,
    "tangential_force_n": -487.2,
    "torque_nm": -19.49,
    "side_thrust_n": -160.0,
    "timestamp_ms": 1234567890123
  }
}
```

### Client -> Server
```json
{ "type": "set_rpm", "payload": { "rpm_target": 3000 } }
```

## Architecture

- **Physics loop** runs on the main thread at 100 Hz with precise timing
- **Boost.Beast** async WebSocket/HTTP server runs on a dedicated IO thread
- **Zero-copy broadcast**: state is serialized once into a pre-allocated `std::array<char, 512>` buffer using `snprintf`; a shared broadcast slot pool avoids per-client heap allocations
- **Lock-free snapshot**: physics writes state atomically, network reads it without blocking
- **Clean shutdown** via Ctrl+C (Windows console handler)

## Troubleshooting

- If port 3001 is in use: change `kPort` in `main.cpp`
- `conan install` fails: ensure `conan profile detect` was run and shows MSVC
- CMake can't find packages: re-run `conan install . --build=missing -s build_type=<Debug|Release>`
- For multi-config generators (VS IDE): use `cmake --preset conan-default` if available, then build with `--config Debug` or `--config Release`
\\\