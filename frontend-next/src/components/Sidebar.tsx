'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTwinStore } from '@/store/twinStore';
import { Gauge, Zap, ArrowUpDown } from 'lucide-react';
import LatencyPanel from './LatencyPanel';
import ReplayControls from './ReplayControls';

const StressChart = dynamic(() => import('./StressChart'), { ssr: false });

interface SidebarProps {
  onSetRpm: (rpm: number) => void;
  onReplay?: (mode: 'live' | 'freeze' | 'seek', tMs?: number) => void;
}

function FatigueGauge({ stressFactor }: { stressFactor: number }) {
  const lifePct = Math.max(0, Math.min(1, 1 - stressFactor * stressFactor));
  const lifePctDisplay = (lifePct * 100).toFixed(1);
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference * (1 - lifePct);

  const getColor = () => {
    if (lifePct > 0.7) return '#22c55e';
    if (lifePct > 0.3) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r="40"
          fill="none" stroke="#1e293b" strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.15s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" className="fill-slate-200 text-lg font-bold"
              style={{ fontSize: '16px' }}>
          {lifePctDisplay}%
        </text>
        <text x="50" y="62" textAnchor="middle" className="fill-slate-500"
              style={{ fontSize: '9px' }}>
          FATIGUE LIFE
        </text>
      </svg>
    </div>
  );
}

function formatForce(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return (n / 1000).toFixed(2) + 'k';
  return n.toFixed(1);
}

export default function Sidebar({ onSetRpm, onReplay }: SidebarProps) {
  const latest = useTwinStore((s) => s.latest);
  const uiRpmTarget = useTwinStore((s) => s.ui.rpmTarget);
  const setRpmTarget = useTwinStore((s) => s.setRpmTarget);
  const connected = useTwinStore((s) => s.ui.connected);

  const [localRpm, setLocalRpm] = useState(1200);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setLocalRpm(val);
  }, []);

  const handleSend = useCallback(() => {
    setRpmTarget(localRpm);
    onSetRpm(localRpm);
  }, [localRpm, setRpmTarget, onSetRpm]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setLocalRpm(Math.max(0, Math.min(8000, val)));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  }, [handleSend]);

  return (
    <div className="w-80 h-full bg-slate-900/95 border-l border-slate-700/50 overflow-y-auto flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <Gauge className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100">Digital Twin</h1>
          <p className="text-[10px] text-slate-500">Control Room</p>
        </div>
        <span
          className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            connected
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {connected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* RPM Control */}
      <div className="bg-slate-800/60 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> RPM Control
        </h3>
        <input
          type="range"
          min={0}
          max={8000}
          step={50}
          value={localRpm}
          onChange={handleSliderChange}
          className="w-full h-1.5 accent-blue-500 cursor-pointer mb-2"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={localRpm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Target: {uiRpmTarget.toFixed(0)} RPM
        </div>
      </div>

      {/* Live Readouts */}
      <div className="bg-slate-800/60 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Live Readouts
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Readout label="RPM" value={latest.rpm.toFixed(0)} unit="rpm" />
          <Readout label="Stress" value={(latest.stress_pa / 1000).toFixed(1)} unit="kPa" />
          <Readout label="Stress Factor" value={latest.stress_factor.toFixed(3)} unit="" />
          <Readout label="Angle" value={(latest.angle_rad * (180 / Math.PI)).toFixed(0)} unit="deg" />
        </div>
      </div>

      {/* Forces */}
      <div className="bg-slate-800/60 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3" /> Forces
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Readout label="Piston" value={formatForce(latest.piston_force_n)} unit="N" />
          <Readout label="Rod" value={formatForce(latest.rod_force_n)} unit="N" />
          <Readout label="Tangential" value={formatForce(latest.tangential_force_n)} unit="N" />
          <Readout label="Side Thrust" value={formatForce(latest.side_thrust_n)} unit="N" />
          <Readout label="Torque" value={latest.torque_nm.toFixed(2)} unit="Nm" />
        </div>
      </div>

      {/* Fatigue Gauge */}
      <div className="bg-slate-800/60 rounded-lg p-3 flex items-center justify-center">
        <FatigueGauge stressFactor={latest.stress_factor} />
      </div>

      {/* Stress Chart */}
      <StressChart />

      {/* Latency Panel */}
      <LatencyPanel />

      {/* Replay Controls */}
      <ReplayControls onReplay={onReplay} />
    </div>
  );
}

function Readout({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-slate-900/50 rounded px-2 py-1.5">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className="text-sm font-mono text-slate-200">
        {value}
        {unit && <span className="text-[10px] text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
