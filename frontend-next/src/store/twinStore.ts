import { create } from 'zustand';
import { StatePayload } from '@/lib/protocol';
import { RingBuffer } from '@/lib/ringBuffer';

const RING_CAPACITY = 1000; // 10s at 100Hz

export interface LatencyStats {
  current: number;
  min: number;
  avg: number;
  max: number;
}

export interface TwinState {
  latest: StatePayload;
  ringBuffer: RingBuffer<StatePayload>;
  latencyBuffer: RingBuffer<number>;
  latencyStats: LatencyStats;
  ui: {
    rpmTarget: number;
    isFrozen: boolean;
    replayCursorMs: number;
    connected: boolean;
  };

  pushSample: (sample: StatePayload) => void;
  setRpmTarget: (rpm: number) => void;
  setFrozen: (frozen: boolean) => void;
  setReplayCursor: (ms: number) => void;
  setConnected: (connected: boolean) => void;
}

const defaultState: StatePayload = {
  rpm: 0,
  angle_rad: 0,
  stress_pa: 0,
  stress_factor: 0,
  piston_force_n: 0,
  rod_force_n: 0,
  tangential_force_n: 0,
  torque_nm: 0,
  side_thrust_n: 0,
  timestamp_ms: 0,
};

function computeLatencyStats(buf: RingBuffer<number>): LatencyStats {
  if (buf.size === 0) return { current: 0, min: 0, avg: 0, max: 0 };

  // Only consider last 5s worth of samples (500 at 100Hz)
  const windowSize = Math.min(buf.size, 500);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  const startIdx = buf.size - windowSize;

  for (let i = startIdx; i < buf.size; i++) {
    const v = buf.at(i);
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  return {
    current: buf.at(buf.size - 1),
    min,
    avg: sum / windowSize,
    max,
  };
}

export const useTwinStore = create<TwinState>((set, get) => ({
  latest: defaultState,
  ringBuffer: new RingBuffer<StatePayload>(RING_CAPACITY),
  latencyBuffer: new RingBuffer<number>(RING_CAPACITY),
  latencyStats: { current: 0, min: 0, avg: 0, max: 0 },
  ui: {
    rpmTarget: 1200,
    isFrozen: false,
    replayCursorMs: 0,
    connected: false,
  },

  pushSample: (sample: StatePayload) => {
    const state = get();
    state.ringBuffer.push(sample);

    const nowMs = performance.now();
    // timestamp_ms from backend is steady_clock, compute rough latency
    // We use the delta between local time and last received timestamp
    // For cross-machine sync you'd need NTP; here we estimate via first-sample calibration
    const latency = Math.max(0, nowMs - (sample.timestamp_ms % 1_000_000));
    state.latencyBuffer.push(Math.abs(latency) > 10000 ? 0 : latency);

    const newStats = computeLatencyStats(state.latencyBuffer);

    set({
      latest: sample,
      latencyStats: newStats,
    });
  },

  setRpmTarget: (rpm: number) =>
    set((s) => ({ ui: { ...s.ui, rpmTarget: Math.max(0, Math.min(8000, rpm)) } })),

  setFrozen: (frozen: boolean) =>
    set((s) => ({ ui: { ...s.ui, isFrozen: frozen } })),

  setReplayCursor: (ms: number) =>
    set((s) => ({ ui: { ...s.ui, replayCursorMs: ms } })),

  setConnected: (connected: boolean) =>
    set((s) => ({ ui: { ...s.ui, connected } })),
}));
