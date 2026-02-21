'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTwinStore } from '@/store/twinStore';

const MAX_CHART_POINTS = 200;

export default function StressChart() {
  const ringBuffer = useTwinStore((s) => s.ringBuffer);
  const latest = useTwinStore((s) => s.latest);

  const data = useMemo(() => {
    const decimated = ringBuffer.toDecimated(MAX_CHART_POINTS);
    return decimated.map((s, i) => ({
      idx: i,
      stress_pa: Math.round(s.stress_pa * 100) / 100,
      stress_factor: Math.round(s.stress_factor * 1000) / 1000,
      rpm: Math.round(s.rpm),
    }));
    // Re-derive when latest changes (100Hz updates but React batches)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringBuffer, latest.timestamp_ms]);

  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Stress vs Time
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="idx" hide />
          <YAxis
            width={45}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              fontSize: '11px',
            }}
          />
          <Line
            type="monotone"
            dataKey="stress_pa"
            stroke="#f97316"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            name="Stress (Pa)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
