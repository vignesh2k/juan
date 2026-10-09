'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardSize } from '../Card';
import { useAnchors } from './anchors';
import { FlipCard } from './FlipCard';
import { pageHidden } from './effects/timing';
import { PILE_POS } from './layout';
import { DEAL_STAGGER_S, DRAW_FLY_S, DRAW_STAGGER_S, EASE_IN_OUT, FADE, SPRING_HAND } from './motion';
import { sortHand } from './sortHand';
import type { Card } from '@/game/types';

interface Props {
  cards: Card[];
  legal: Set<string>;
  size: CardSize;
  width: number;
  height: number;
  shake: { id: string; n: number };
  /** Cards that are on their way to (or already on) the pile: keep their slot, don't show them. */
  hidden: ReadonlySet<string>;
  /** The card whose play is being sent: lifted a little while we wait for the server. */
  sendingId: string | null;
  /** A fresh deal: the first hand that shows up flies in card by card. */
  dealing: boolean;
  reduced: boolean;
  onPlay: (card: Card) => void;
}

/** Matches the .juan-card border radius (0.6em of each size's font-size). */
const RADIUS: Record<CardSize, number> = { xs: 3, sm: 3.9, md: 6.3, lg: 8.1 };

/** True on devices with a real hover (mouse); touch screens would leave a tapped card stuck "lifted". */
function useCanHover() {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return canHover;
}

export function Hand({ cards, legal, size, width, height, shake, hidden, sendingId, dealing, reduced, onPlay }: Props) {
  const anchors = useAnchors();
  const canHover = useCanHover();
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

  // Cards we have already shown (null until the first hand is on screen). New ones fly in from
  // the deck; the very first hand only does so for a fresh deal, not when reopening a game.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (cards.length || known.current) known.current = new Set(cards.map((c) => c.id));
  }, [cards]);
  const fresh = cards.filter((c) => (known.current ? !known.current.has(c.id) : dealing)).map((c) => c.id); // in dealt/drawn order
  const stagger = fresh.length >= 5 ? DEAL_STAGGER_S : DRAW_STAGGER_S;
  // Where a card's untransformed box sits: centred, 12px above the bottom of the screen.
  const homeX = width / 2;
  const homeY = height - 12 - cardH / 2;
  // The deck sits left of the discard pile, the pair centred at PILE_POS. On the very first render
  // (dealing straight after mount) it isn't measurable yet, so estimate it from that layout.
  const deck = fresh.length && !reduced && !pageHidden()
    ? anchors.get('deck') ?? { x: (PILE_POS.x / 100) * width - (cardW + (width >= 768 ? 40 : 24)) / 2, y: (PILE_POS.y / 100) * height }
    : null;

  return (
    <div ref={anchors.ref('hand')} className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[28vh] min-h-[170px]">
      <AnimatePresence>
        {sorted.map((card, i) => {
          const off = i - (n - 1) / 2;
          const t = n > 1 ? off / ((n - 1) / 2) : 0; // -1 … 1 across the fan
          const playable = legal.has(card.id);
          const rot = t * tilt;
          const k = fresh.indexOf(card.id);
          const delay = k < 0 ? 0 : k * stagger + (fresh.length >= 5 ? 0.15 : 0);
          const fromDeck = k >= 0 && deck ? { x: deck.x - homeX, y: deck.y - homeY, rotate: 0, scale: 1, opacity: 1 } : null;
          const lift = sendingId === card.id ? 36 : playable ? 22 : 0;
          return (
            <motion.button key={card.id} ref={anchors.ref(`card:${card.id}`)} data-rot={rot} onClick={() => onPlay(card)}
              className="pointer-events-auto absolute bottom-3 left-1/2"
              style={{ zIndex: i, marginLeft: -cardW / 2, transformOrigin: '50% 120%', visibility: hidden.has(card.id) ? 'hidden' : 'visible' }}
              initial={k < 0 ? false : fromDeck ?? { opacity: 0 }}
              animate={{ x: off * step, y: t * t * 18 - lift, rotate: rot, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              whileHover={playable && canHover ? { y: -48, scale: 1.08 } : undefined}
              transition={k >= 0 ? { type: 'spring', visualDuration: DRAW_FLY_S, bounce: 0.18, delay, opacity: { ...FADE, delay } } : SPRING_HAND}>
              <motion.div key={shake.id === card.id ? shake.n : 0} animate={shake.id === card.id ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.35 }}>
                <FlipCard card={card} size={size}
                  initial={fromDeck ? { rotateY: 180 } : false} animate={{ rotateY: 0 }}
                  transition={{ duration: DRAW_FLY_S * 0.7, delay: delay + DRAW_FLY_S * 0.15, ease: EASE_IN_OUT }}
                  overlay={
                    // Dim unplayable cards with an overlay's opacity (cheap) rather than a filter on every card.
                    <motion.div className="pointer-events-none absolute inset-0 bg-black" style={{ borderRadius: RADIUS[size] }}
                      initial={false} animate={{ opacity: playable ? 0 : 0.45 }} transition={FADE} />
                  } />
              </motion.div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
