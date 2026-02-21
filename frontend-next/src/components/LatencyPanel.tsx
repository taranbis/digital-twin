'use client';

import { useTwinStore } from '@/store/twinStore';
import { Activity } from 'lucide-react';

export default function LatencyPanel() {
  const stats = useTwinStore((s) => s.latencyStats);
  const connected = useTwinStore((s) => s.ui.connected);

  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-emerald-400" />
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Latency
        </h3>
        <span
          className={`ml-auto w-2 h-2 rounded-full ${
            connected ? 'bg-emerald-400' : 'bg-red-500'
          }`}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Now', value: stats.current },
          { label: 'Min', value: stats.min },
          { label: 'Avg', value: stats.avg },
          { label: 'Max', value: stats.max },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-[10px] text-slate-500 uppercase">{item.label}</div>
            <div className="text-sm font-mono text-slate-200">
              {item.value.toFixed(1)}
              <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
