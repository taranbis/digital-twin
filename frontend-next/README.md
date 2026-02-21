# Digital Twin Frontend (Next.js 14)

Real-time 3D dashboard for monitoring and controlling a rotating automotive component digital twin.

## Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** or **yarn**

## Install

```powershell
cd frontend-next
npm install
```

## Run (Development)

```powershell
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

Ensure the C++ backend is running on `ws://localhost:3001` before opening the dashboard.

## Architecture

### Performance Design

- **100 Hz data ingestion**: WebSocket receives state updates at 100 Hz, pushed into a Zustand store and ring buffer
- **60 fps 3D rendering**: React Three Fiber's `useFrame` reads state directly via `getState()` (no React re-render per WS tick)
- **Chart decimation**: Ring buffer of 1000 samples decimated to ~200 points for Recharts rendering
- **Reconnection**: Exponential backoff WebSocket reconnection (500ms to 8s)

### Components

| Component | Role |
|-----------|------|
| `Scene` | 3D viewport with rotating cylinder, color-coded by stress |
| `Sidebar` | RPM controls, live readouts, fatigue gauge |
| `StressChart` | Stress vs time line chart (recharts) |
| `LatencyPanel` | Real-time latency stats (current/min/avg/max over 5s) |
| `ReplayControls` | Live/Freeze toggle and timeline scrubber |

### Store (Zustand)

- `latest` - most recent StatePayload
- `ringBuffer` - last 10s of samples (1000 capacity)
- `latencyBuffer` - latency measurements for stats
- `ui` - RPM target, frozen state, replay cursor, connection status

### Protocol

Isolated in `src/lib/protocol.ts` with strict type guards. Ready for binary/Protobuf upgrade by swapping the serialization layer.
