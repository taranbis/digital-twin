'use client';

import { useTwinStore } from '@/store/twinStore';
import { Play, Pause, SkipBack } from 'lucide-react';

interface ReplayControlsProps {
  onReplay?: (mode: 'live' | 'freeze' | 'seek', tMs?: number) => void;
}

export default function ReplayControls({ onReplay }: ReplayControlsProps) {
  const isFrozen = useTwinStore((s) => s.ui.isFrozen);
  const replayCursorMs = useTwinStore((s) => s.ui.replayCursorMs);
  const ringBuffer = useTwinStore((s) => s.ringBuffer);
  const setFrozen = useTwinStore((s) => s.setFrozen);
  const setReplayCursor = useTwinStore((s) => s.setReplayCursor);

  const oldestTs = ringBuffer.size > 0 ? ringBuffer.at(0).timestamp_ms : 0;
  const newestTs = ringBuffer.size > 0 ? ringBuffer.at(ringBuffer.size - 1).timestamp_ms : 0;
  const rangeMs = newestTs - oldestTs;

  const handleLive = () => {
    setFrozen(false);
    setReplayCursor(0);
    onReplay?.('live');
  };

  const handleFreeze = () => {
    setFrozen(true);
    setReplayCursor(newestTs);
    onReplay?.('freeze');
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    const tMs = oldestTs + pct * rangeMs;
    setReplayCursor(tMs);
    onReplay?.('seek', tMs);
  };

  const scrubPct = rangeMs > 0 ? (replayCursorMs - oldestTs) / rangeMs : 0;

  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Record / Replay
      </h3>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleLive}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            !isFrozen
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          <Play className="w-3 h-3" /> LIVE
        </button>
        <button
          onClick={handleFreeze}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            isFrozen
              ? 'bg-amber-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          <Pause className="w-3 h-3" /> FREEZE
        </button>
        <button
          onClick={() => {
            setReplayCursor(oldestTs);
            onReplay?.('seek', oldestTs);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
        >
          <SkipBack className="w-3 h-3" /> START
        </button>
      </div>
      {isFrozen && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={scrubPct}
          onChange={handleScrub}
          className="w-full h-1.5 accent-amber-500 cursor-pointer"
        />
      )}
      <div className="text-[10px] text-slate-500 mt-1">
        Buffer: {(rangeMs / 1000).toFixed(1)}s ({ringBuffer.size} samples)
      </div>
    </div>
  );
}
