'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { BANNER_MS, SPRING_POP } from '../motion';
import { useLandingEffect, useTimers } from './timing';
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

/** The big centre banner. One at a time: a newer action's banner replaces the current one. */
export function Banner({ lastAction, nameOf, reduced }: { lastAction: LastAction; nameOf: (id: string) => string; reduced: boolean }) {
  const later = useTimers();
  const [banner, setBanner] = useState<{ seq: number; text: string; tone: Tone } | null>(null);

  const newest = useRef(0);
  const show = (a: LastAction) => {
    const b = bannerFor(a, nameOf);
    // A play's banner waits for its landing; by then a newer action's banner may already be up.
    if (!b || a.seq < newest.current) return;
    newest.current = a.seq;
    setBanner({ seq: a.seq, ...b });
    later(() => setBanner((cur) => (cur?.seq === a.seq ? null : cur)), BANNER_MS);
  };
  // Jump-ins announce themselves straight away (with the burst at the jumper); other plays when they land.
  useLandingEffect(lastAction, reduced, (a) => { if (a.type !== 'jump') show(a); }, (a) => { if (a.type === 'jump') show(a); });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[24%] z-50 flex justify-center" aria-live="polite">
      <AnimatePresence mode="wait">
        {banner && (
          <motion.div key={banner.seq}
            initial={{ scale: 0.3, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -3 }}
            exit={{ scale: 1.25, opacity: 0, transition: { duration: 0.12 } }}
            transition={SPRING_POP}>
            <span className={`block rounded-2xl bg-gradient-to-br px-6 py-3 font-display text-3xl shadow-2xl ring-4 ring-white/30 md:text-5xl ${TONE[banner.tone]}`}>
              {banner.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
