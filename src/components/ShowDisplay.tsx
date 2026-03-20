"use client";

import { useMemo } from "react";

export default function ShowDisplay() {
  const lightColors = useMemo(() => [
    { color: "#eab308", glow: "rgba(234, 179, 8, 0.4)" },
    { color: "#06b6d4", glow: "rgba(6, 182, 212, 0.4)" },
    { color: "#ec4899", glow: "rgba(236, 72, 153, 0.4)" },
    { color: "#a855f7", glow: "rgba(168, 85, 247, 0.4)" },
    { color: "#22c55e", glow: "rgba(34, 197, 94, 0.4)" },
  ], []);

  return (
    <div className="h-full w-full relative overflow-hidden bg-[#05070f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.08),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(236,72,153,0.12),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,_rgba(34,197,94,0.12),_transparent_55%)]" />

      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

      <div className="absolute inset-0 flex items-start justify-center overflow-hidden pointer-events-none">
        <div className="relative w-full h-full">
          <div className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ left: 'calc(50% - 180px)' }}>
            <div className="w-0 h-0"
              style={{
                filter: 'blur(3px)',
                width: '320px',
                height: '100vh',
                background: 'linear-gradient(to bottom, rgba(250,204,21,0.6) 0%, rgba(250,204,21,0) 100%)',
                clipPath: 'polygon(40% 0%, 60% 0%, 75% 100%, 25% 100%)',
                animation: 'beamSwing 12s ease-in-out infinite',
                transformOrigin: '50% 0%',
              }} />
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ left: '50%' }}>
            <div className="w-0 h-0"
              style={{
                filter: 'blur(3px)',
                width: '350px',
                height: '100vh',
                background: 'linear-gradient(to bottom, rgba(34,211,238,0.6) 0%, rgba(34,211,238,0) 100%)',
                clipPath: 'polygon(40% 0%, 60% 0%, 78% 100%, 22% 100%)',
                animation: 'beamSwing 14s ease-in-out infinite 3s',
                transformOrigin: '50% 0%',
              }} />
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ left: 'calc(50% + 180px)' }}>
            <div className="w-0 h-0"
              style={{
                filter: 'blur(3px)',
                width: '300px',
                height: '100vh',
                background: 'linear-gradient(to bottom, rgba(244,114,182,0.6) 0%, rgba(244,114,182,0) 100%)',
                clipPath: 'polygon(40% 0%, 60% 0%, 72% 100%, 28% 100%)',
                animation: 'beamSwing 11s ease-in-out infinite 6s',
                transformOrigin: '50% 0%',
              }} />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-end justify-center overflow-hidden pointer-events-none">
        <div className="relative w-full h-full">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{ left: 'calc(50% - 180px)' }}>
            <div className="w-0 h-0"
              style={{
                filter: 'blur(3px)',
                width: '320px',
                height: '100vh',
                background: 'linear-gradient(to top, rgba(168,85,247,0.6) 0%, rgba(168,85,247,0) 100%)',
                clipPath: 'polygon(25% 0%, 75% 0%, 60% 100%, 40% 100%)',
                animation: 'beamSwing 13s ease-in-out infinite 1s',
                transformOrigin: '50% 100%',
              }} />
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{ left: '50%' }}>
            <div className="w-0 h-0"
              style={{
                filter: 'blur(3px)',
                width: '350px',
                height: '100vh',
                background: 'linear-gradient(to top, rgba(234,179,8,0.6) 0%, rgba(234,179,8,0) 100%)',
                clipPath: 'polygon(22% 0%, 78% 0%, 62% 100%, 38% 100%)',
                animation: 'beamSwing 15s ease-in-out infinite 4s',
                transformOrigin: '50% 100%',
              }} />
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{ left: 'calc(50% + 180px)' }}>
            <div className="w-0 h-0"
              style={{
                filter: 'blur(3px)',
                width: '300px',
                height: '100vh',
                background: 'linear-gradient(to top, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0) 100%)',
                clipPath: 'polygon(28% 0%, 72% 0%, 58% 100%, 42% 100%)',
                animation: 'beamSwing 12s ease-in-out infinite 7s',
                transformOrigin: '50% 100%',
              }} />
          </div>
        </div>
      </div>

      {/* <div className="absolute inset-x-0 top-4 flex items-center justify-center gap-6">
        {lightColors.map((light, index) => (
          <div
            key={light.color}
            className="relative"
            style={{ animation: `light-head-pulse ${1.2 + index * 0.2}s ease-in-out infinite` }}
          >
            <div
              className="h-6 w-6 rounded-full border-4 border-white/20"
              style={{
                backgroundColor: light.color,
                boxShadow: `0 0 40px ${light.color}, 0 0 80px ${light.glow}`,
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: light.color,
                opacity: 0.4,
                animation: `light-flash ${0.7 + index * 0.1}s ease-in-out infinite`,
              }}
            />
          </div>
        ))}
      </div> */}

      <div className="absolute inset-x-0 bottom-0 h-1/3">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-pink-500/40" />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-40">
        <svg className="absolute bottom-0 left-1/2 h-40 w-[90%] -translate-x-1/2" viewBox="0 0 1200 200">
          <defs>
            <linearGradient id="stage-edge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path
            d="M60 140 L200 60 L1000 60 L1140 140 L1000 180 L200 180 Z"
            fill="rgba(15,15,20,0.9)"
            stroke="url(#stage-edge)"
            strokeWidth="3"
          />
          <rect x="220" y="80" width="760" height="50" rx="12" fill="rgba(255,255,255,0.04)" />
          <rect x="260" y="92" width="120" height="20" rx="8" fill="rgba(250,204,21,0.6)" />
          <rect x="410" y="92" width="120" height="20" rx="8" fill="rgba(34,211,238,0.6)" />
          <rect x="560" y="92" width="120" height="20" rx="8" fill="rgba(244,114,182,0.6)" />
          <rect x="710" y="92" width="120" height="20" rx="8" fill="rgba(168,85,247,0.6)" />
        </svg>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.18) 0%, transparent 45%)",
          animation: "strobe 0.15s ease-in-out infinite",
          opacity: 0.06,
        }}
      />

      <div className="absolute right-6 bottom-24 flex flex-col items-end gap-3 text-right text-[10px] uppercase tracking-[0.35em] text-white/60">
        <div className="flex items-center gap-2">
          <span className="h-1 w-8 rounded-full bg-green-400" />
          Live
        </div>
        <div>Stage Alpha</div>
        <div>Signal Ready</div>
      </div>
    </div>
  );
}
