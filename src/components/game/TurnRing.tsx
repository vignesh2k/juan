'use client';
import { useNow } from '@/lib/hooks';
import { serverNow } from '@/lib/serverClock';
import { TURN_MS } from '@/game/types';

export function TurnRing({ deadline, size, children }: { deadline: number; size: number; children: React.ReactNode }) {
  useNow(200); // re-render on a tick; the deadline is on the server's clock
  const frac = Math.max(0, Math.min(1, (deadline - serverNow()) / TURN_MS));
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const color = frac > 0.5 ? '#4ade80' : frac > 0.2 ? '#facc15' : '#f87171';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.15)" strokeWidth={4} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} style={{ transition: 'stroke-dashoffset .2s linear, stroke .3s' }} />
      </svg>
      <div className="absolute inset-[5px] grid place-items-center">{children}</div>
    </div>
  );
}
