'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CardBack, CardFace, COLOR_HEX, type CardSize } from '../Card';
import { offsetFrom, PILE_POS, type Pos } from './layout';
import type { Card, PublicState } from '@/game/types';

const tilt = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) % 997;
  return (h % 36) - 18;
};

interface Props {
  pub: PublicState;
  size: CardSize;
  enterFrom: Pos;
  canDraw: boolean;
  onDraw: () => void;
}

export function CenterPile({ pub, size, enterFrom, canDraw, onDraw }: Props) {
  const [pile, setPile] = useState<Card[]>([pub.topCard]);
  const isStart = pub.lastAction.type === 'start';
  useEffect(() => {
    const top = pub.topCard;
    // A fresh game drops the previous game's cards; ids recur after reshuffles, so never keep duplicates.
    setPile((p) => (isStart ? [top] : p[p.length - 1]?.id === top.id ? p : [...p.filter((x) => x.id !== top.id).slice(-4), top]));
  }, [pub.topCard, isStart]);
  const glow = COLOR_HEX[pub.currentColor];

  return (
    <div className="absolute z-0 -translate-x-1/2 -translate-y-1/2" style={{ left: `${PILE_POS.x}%`, top: `${PILE_POS.y}%` }}>
      <motion.div key={pub.direction} className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 md:h-80 md:w-80"
        animate={{ rotate: pub.direction * 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 14 }}>
        <svg viewBox="0 0 100 100" className="h-full w-full opacity-40">
          <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="6 5" />
          {[0, 120, 240].map((a) => (
            <g key={a} transform={`rotate(${a} 50 50)`}>
              <path d={pub.direction === 1 ? 'M50 1 l5 3 -5 3z' : 'M50 1 l-5 3 5 3z'} fill="white" />
            </g>
          ))}
        </svg>
      </motion.div>

      <div className="relative flex items-center gap-6 md:gap-10">
        <button onClick={onDraw} disabled={!canDraw} className="relative" aria-label="Draw a card">
          {[2, 1, 0].map((i) => (
            <div key={i} className={i ? 'absolute' : 'relative'} style={{ top: -i * 3, left: -i * 2 }}>
              <CardBack size={size} />
            </div>
          ))}
          {canDraw && (
            <motion.div className="absolute -inset-2 rounded-2xl ring-4 ring-yellow-300/80" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} />
          )}
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/60">{pub.drawPileCount}</span>
        </button>

        <div className="relative">
          <motion.div className="absolute -inset-5 rounded-full blur-2xl" animate={{ backgroundColor: glow, opacity: 0.55 }} transition={{ duration: 0.4 }} />
          <div className="relative">
            <AnimatePresence initial={false}>
              {pile.map((card, i) => (
                <motion.div key={card.id} className={i === 0 ? 'relative' : 'absolute inset-0'}
                  initial={{ ...offsetFrom(enterFrom, PILE_POS), rotate: tilt(card.id) - 40, rotateY: 180, scale: 0.7 }}
                  animate={{ x: '0vw', y: '0vh', rotate: tilt(card.id), rotateY: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
                  <CardFace card={card} size={size} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {pub.pendingDraw && (
              <motion.div key="stack" initial={{ scale: 0 }} animate={{ scale: [1, 1.15, 1] }} exit={{ scale: 0 }}
                transition={{ scale: { repeat: Infinity, duration: 0.9 } }}
                className="absolute -right-6 -top-6 z-20 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-red-600 font-display text-xl shadow-xl ring-2 ring-white">
                +{pub.pendingDraw.count}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
