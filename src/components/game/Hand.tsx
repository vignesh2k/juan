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
  const n = sorted.length;
  const avail = Math.min(width - 24, 980);
  const step = n > 1 ? Math.min(cardW * 0.72, (avail - cardW) / (n - 1)) : 0;
  const spread = Math.min(6, 48 / Math.max(n, 1));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[28vh] min-h-[170px]">
      <AnimatePresence>
        {sorted.map((card, i) => {
          const off = i - (n - 1) / 2;
          const playable = legal.has(card.id);
          return (
            <motion.button key={card.id} layout onClick={() => onPlay(card)}
              className="pointer-events-auto absolute bottom-3 left-1/2"
              style={{ zIndex: i, marginLeft: -cardW / 2, transformOrigin: '50% 120%' }}
              initial={{ y: -320, opacity: 0, scale: 0.6 }}
              animate={{ x: off * step, y: off * off * 1.4 - (playable ? 22 : 0), rotate: off * spread, opacity: 1, scale: 1, filter: playable ? 'brightness(1)' : 'brightness(0.55)' }}
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
