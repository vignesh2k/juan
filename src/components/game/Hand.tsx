'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { CardFace, type CardSize } from '../Card';
import { sortHand } from './sortHand';
import type { Card } from '@/game/types';

interface Props {
  cards: Card[];
  legal: Set<string>;
  size: CardSize;
  width: number;
  shake: { id: string; n: number };
  onPlay: (card: Card) => void;
}

export function Hand({ cards, legal, size, width, shake, onPlay }: Props) {
  const sorted = useMemo(() => sortHand(cards), [cards]);
  const cardW = size === 'lg' ? 90 : 70;
  const cardH = cardW * 1.5;
  const n = sorted.length;
  // Edge-card tilt in degrees; eases off for big hands so the fan stays on screen.
  const tilt = n > 1 ? Math.min(18, (n - 1) * 3, 220 / n) : 0;
  // How far a tilted edge card's top corner swings outward (it pivots ~1.2 card heights down).
  const reach = cardH * 1.2 * Math.sin((tilt * Math.PI) / 180);
  const avail = Math.min(width - 24, 980) - 2 * reach;
  const step = n > 1 ? Math.min(cardW * 0.72, (avail - cardW) / (n - 1)) : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[28vh] min-h-[170px]">
      <AnimatePresence>
        {sorted.map((card, i) => {
          const off = i - (n - 1) / 2;
          const t = n > 1 ? off / ((n - 1) / 2) : 0; // -1 … 1 across the fan
          const playable = legal.has(card.id);
          return (
            <motion.button key={card.id} layout onClick={() => onPlay(card)}
              className="pointer-events-auto absolute bottom-3 left-1/2"
              style={{ zIndex: i, marginLeft: -cardW / 2, transformOrigin: '50% 120%' }}
              initial={{ y: -320, opacity: 0, scale: 0.6 }}
              animate={{ x: off * step, y: t * t * 18 - (playable ? 22 : 0), rotate: t * tilt, opacity: 1, scale: 1, filter: playable ? 'brightness(1)' : 'brightness(0.55)' }}
              exit={{ y: -280, opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
              whileHover={playable ? { y: -48, scale: 1.08 } : undefined}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
              <motion.div key={shake.id === card.id ? shake.n : 0} animate={shake.id === card.id ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.35 }}>
                <CardFace card={card} size={size} />
              </motion.div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
