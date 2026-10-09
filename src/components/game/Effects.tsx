'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CardBack } from '../Card';
import { PILE_POS, type Pos } from './layout';
import type { LastAction } from '@/game/types';

type Tone = 'gold' | 'red' | 'purple' | 'blue' | 'green' | 'gray';
const TONE: Record<Tone, string> = {
  gold: 'from-yellow-300 to-amber-500 text-black',
  red: 'from-red-500 to-rose-700',
  purple: 'from-fuchsia-500 to-violet-700',
  blue: 'from-sky-400 to-blue-700',
  green: 'from-emerald-400 to-green-700',
  gray: 'from-zinc-500 to-zinc-700',
};

function bannerFor(a: LastAction, nameOf: (id: string) => string): { text: string; tone: Tone } | null {
  if ((a.type === 'play' || a.type === 'jump') && a.penalty) return { text: "Can't finish on a power card! +1", tone: 'red' };
  switch (a.type) {
    case 'juan': return { text: `${nameOf(a.playerId)}: JUAN!`, tone: 'gold' };
    case 'catch': return { text: `${nameOf(a.targetId ?? '')} got caught! +2`, tone: 'red' };
    case 'jump': return { text: `${nameOf(a.playerId)} JUMPED IN!`, tone: 'purple' };
    case 'stackDraw': return { text: `${nameOf(a.playerId)} draws ${a.n}`, tone: 'red' };
    case 'timeout': return { text: `${nameOf(a.playerId)} ran out of time`, tone: 'gray' };
    case 'play':
      if (a.card?.value === 'wild4') return { text: '+4!', tone: 'red' };
      if (a.card?.value === 'draw2') return { text: '+2!', tone: 'red' };
      if (a.card?.value === 'skip') return { text: 'SKIP!', tone: 'blue' };
      if (a.card?.value === 'reverse') return { text: 'REVERSE!', tone: 'green' };
      return null;
    default: return null;
  }
}

function drawsFor(a: LastAction): { target: string; n: number } | null {
  if (a.type === 'catch') return { target: a.targetId ?? '', n: a.n ?? 0 };
  if (a.type === 'draw' || a.type === 'stackDraw' || a.type === 'timeout') return { target: a.playerId, n: a.n ?? 0 };
  if (a.penalty) return { target: a.playerId, n: 1 };
  return null;
}

export function Effects({ lastAction, nameOf, posOf }: { lastAction: LastAction; nameOf: (id: string) => string; posOf: (id: string) => Pos }) {
  const firstSeq = useRef(lastAction.seq);
  const [banner, setBanner] = useState<{ seq: number; text: string; tone: Tone } | null>(null);
  const [flyers, setFlyers] = useState<{ key: string; to: Pos; delay: number }[]>([]);

  useEffect(() => {
    if (lastAction.seq === firstSeq.current) return;
    const b = bannerFor(lastAction, nameOf);
    if (b) {
      setBanner({ seq: lastAction.seq, ...b });
      const seq = lastAction.seq;
      setTimeout(() => setBanner((cur) => (cur?.seq === seq ? null : cur)), 1400);
    }
    const d = drawsFor(lastAction);
    if (d && d.n > 0) {
      const to = posOf(d.target);
      setFlyers((f) => [...f, ...Array.from({ length: Math.min(d.n, 8) }, (_, i) => ({ key: `${lastAction.seq}-${i}`, to, delay: i * 0.08 }))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction.seq]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {flyers.map((f) => (
        <motion.div key={f.key} className="absolute -translate-x-1/2 -translate-y-1/2"
          initial={{ left: `${PILE_POS.x}%`, top: `${PILE_POS.y}%`, opacity: 1, scale: 1 }}
          animate={{ left: `${f.to.x}%`, top: `${f.to.y}%`, opacity: [1, 1, 0], scale: 0.6 }}
          transition={{ duration: 0.55, delay: f.delay, ease: 'easeInOut' }}
          onAnimationComplete={() => setFlyers((xs) => xs.filter((x) => x.key !== f.key))}>
          <CardBack size="sm" />
        </motion.div>
      ))}
      <AnimatePresence>
        {banner && (
          <motion.div key={banner.seq} className="absolute inset-x-0 top-[24%] flex justify-center"
            initial={{ scale: 0.3, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} exit={{ scale: 1.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
            <span className={`rounded-2xl bg-gradient-to-br px-6 py-3 font-display text-3xl shadow-2xl ring-4 ring-white/30 md:text-5xl ${TONE[banner.tone]}`}>
              {banner.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
