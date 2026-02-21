'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { useTwinSocket } from '@/hooks/useTwinSocket';

const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-600 text-sm">
      Loading 3D scene&hellip;
    </div>
  ),
});

export default function Home() {
  const { sendSetRpm, sendReplay } = useTwinSocket();

  return (
    <div className="flex h-screen w-screen">
      <div className="flex-1 relative">
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400 border border-slate-700/50">
          Digital Twin &mdash; Rotating Component Simulator
        </div>
      </div>
      <Sidebar onSetRpm={sendSetRpm} onReplay={sendReplay} />
    </div>
  );
}
