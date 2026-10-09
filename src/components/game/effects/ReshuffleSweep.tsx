'use client';
import { motion } from 'motion/react';
import { useState } from 'react';
import { CardBack, type CardSize } from '../../Card';
import { useAnchors } from '../anchors';
import { FlipCard } from '../FlipCard';
import { EASE_IN_OUT, EASE_OUT, SPRING_POP } from '../motion';
import { tilt } from '../tilt';
import { pageHidden, useTimers } from './timing';
import { useChangeEffect } from '@/lib/hooks';
import type { Card, LastAction } from '@/game/types';

interface Sweep { seq: number; cards: Card[]; dx: number; dy: number }

const SWEEP_S = 0.4;
const SWEEP_STAGGER_S = 0.05;
const RIFFLE_S = 0.5;

/**
 * When an action reshuffled the discard pile into the deck: the cards under the top card sweep
 * across into the deck (turning face down), the deck riffles, and a "Reshuffled!" tag pops above
 * it. Rendered inside the deck's box, so (0,0) is the deck.
 */
export function ReshuffleSweep({ lastAction, pile, topId, size, reduced, onSwept }: {
  lastAction: LastAction; pile: Card[]; topId: string; size: CardSize; reduced: boolean;
  /** Drop everything but `keepId` from the visible discard pile (those cards are now in the deck). */
  onSwept: (keepId: string) => void;
}) {
  const anchors = useAnchors();
  const later = useTimers();
  const [sweep, setSweep] = useState<Sweep | null>(null);

  useChangeEffect(lastAction.seq, () => {
    if (!lastAction.reshuffled) return;
    if (pageHidden()) return onSwept(topId);
    const deck = anchors.get('deck');
    const discard = anchors.get('discard');
    const cards = reduced ? [] : pile.filter((c) => c.id !== topId).slice(-4);
    const seq = lastAction.seq;
    setSweep({ seq, cards, dx: discard && deck ? discard.x - deck.x : 120, dy: discard && deck ? discard.y - deck.y : 0 });
    onSwept(topId);
    later(() => setSweep((s) => (s?.seq === seq ? null : s)), 1400);
  });

  if (!sweep) return null;
  const riffleDelay = sweep.cards.length ? SWEEP_S + (sweep.cards.length - 1) * SWEEP_STAGGER_S : 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden key={sweep.seq}>
      {sweep.cards.map((card, i) => (
        <motion.div key={card.id} className="absolute left-0 top-0"
          initial={{ x: sweep.dx, y: sweep.dy, rotate: tilt(card.id), opacity: 1 }}
          animate={{ x: 0, y: 0, rotate: 0, opacity: [1, 1, 0] }}
          transition={{ duration: SWEEP_S, delay: i * SWEEP_STAGGER_S, ease: EASE_OUT, opacity: { duration: SWEEP_S, delay: i * SWEEP_STAGGER_S, times: [0, 0.85, 1] } }}>
          <FlipCard card={card} size={size} initial={{ rotateY: 0 }} animate={{ rotateY: 180 }}
            transition={{ duration: SWEEP_S * 0.6, delay: i * SWEEP_STAGGER_S, ease: EASE_IN_OUT }} />
        </motion.div>
      ))}
      {!reduced && [-1, 1].map((side) => (
        // Two halves of the deck split and shuffle back together, twice.
        <motion.div key={side} className="absolute left-0 top-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 1, 1, 0], x: [0, side * 22, 0, side * 16, 0, 0], y: [0, -6, 0, -4, 0, 0], rotate: [0, side * 8, 0, side * 5, 0, 0] }}
          transition={{ duration: RIFFLE_S, delay: riffleDelay, ease: EASE_IN_OUT, times: [0, 0.25, 0.5, 0.7, 0.9, 1] }}>
          <CardBack size={size} />
        </motion.div>
      ))}
      <motion.div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-br from-sky-400 to-blue-700 px-3 py-1 font-display text-base shadow-xl ring-2 ring-white/70"
          initial={{ scale: 0.4, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: [0, 1, 1, 0], y: 0 }}
          transition={{ default: SPRING_POP, opacity: { duration: 1.3, times: [0, 0.1, 0.8, 1] } }}>
          Reshuffled!
      </motion.div>
    </div>
  );
}
