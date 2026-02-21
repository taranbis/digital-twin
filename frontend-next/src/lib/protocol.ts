// ── Protocol types mirroring backend Protocol.h ──

export interface StatePayload {
  rpm: number;
  angle_rad: number;
  stress_pa: number;
  stress_factor: number;
  piston_force_n: number;
  rod_force_n: number;
  tangential_force_n: number;
  torque_nm: number;
  side_thrust_n: number;
  timestamp_ms: number;
}

export interface StateMessage {
  type: 'state';
  payload: StatePayload;
}

export interface SetRpmPayload {
  rpm_target: number;
}

export interface SetRpmMessage {
  type: 'set_rpm';
  payload: SetRpmPayload;
}

export interface ReplayPayload {
  mode: 'live' | 'freeze' | 'seek';
  t_ms?: number;
}

export interface ReplayMessage {
  type: 'replay';
  payload: ReplayPayload;
}

export type ServerMessage = StateMessage;
export type ClientMessage = SetRpmMessage | ReplayMessage;

// ── Type guards ──

export function isStateMessage(msg: unknown): msg is StateMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== 'state') return false;
  const p = m.payload;
  if (typeof p !== 'object' || p === null) return false;
  const pl = p as Record<string, unknown>;
  if (
    typeof pl.rpm !== 'number' ||
    typeof pl.angle_rad !== 'number' ||
    typeof pl.stress_pa !== 'number' ||
    typeof pl.stress_factor !== 'number' ||
    typeof pl.timestamp_ms !== 'number'
  ) return false;
  // Default force fields to 0 if missing (backward compat)
  pl.piston_force_n ??= 0;
  pl.rod_force_n ??= 0;
  pl.tangential_force_n ??= 0;
  pl.torque_nm ??= 0;
  pl.side_thrust_n ??= 0;
  return true;
}

export function serializeSetRpm(rpmTarget: number): string {
  return JSON.stringify({
    type: 'set_rpm',
    payload: { rpm_target: Math.max(0, Math.min(8000, rpmTarget)) },
  });
}

export function serializeReplay(mode: ReplayPayload['mode'], tMs?: number): string {
  return JSON.stringify({
    type: 'replay',
    payload: { mode, ...(tMs !== undefined ? { t_ms: tMs } : {}) },
  });
}
