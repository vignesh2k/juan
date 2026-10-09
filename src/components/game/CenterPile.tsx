'use client';
import { AnimatePresence, motion, useAnimationFrame, useMotionValue } from 'motion/react';
import { useEffect, useState } from 'react';
import { CardBack, CardFace, COLOR_HEX, type CardSize } from '../Card';
import { useAnchors } from './anchors';
import { ReshuffleSweep } from './effects/ReshuffleSweep';
import { useDelayedValue } from './effects/timing';
import { PILE_POS } from './layout';
import { EASE_OUT, FADE, pulse, SPRING_POP } from './motion';
import { tilt } from './tilt';
import { COLORS, type Card, type PublicState } from '@/game/types';

interface Props {
  pub: PublicState;
  size: CardSize;
  canDraw: boolean;
  /** Cards still flying to the pile: in the stack already, but invisible until they land. */
  hidden: ReadonlySet<string>;
  /** How long until the current action's card lands; colour, direction and stack changes wait for it. */
  landDelay: number;
  reduced: boolean;
  onDraw: () => void;
}

export function CenterPile({ pub, size, canDraw, hidden, landDelay, reduced, onDraw }: Props) {
  const anchors = useAnchors();
  const [pile, setPile] = useState<Card[]>([pub.topCard]);
  const isStart = pub.lastAction.type === 'start';
  useEffect(() => {
    const top = pub.topCard;
    // A fresh game drops the previous game's cards; ids recur after reshuffles, so never keep duplicates.
    setPile((p) => (isStart ? [top] : p[p.length - 1]?.id === top.id ? p : [...p.filter((x) => x.id !== top.id).slice(-4), top]));
  }, [pub.topCard, isStart]);

  // What the table shows changes when the card lands, not when the snapshot arrives.
  const color = useDelayedValue(pub.currentColor, landDelay);
  const direction = useDelayedValue(pub.direction, landDelay);
  const stack = useDelayedValue(pub.pendingDraw?.count ?? 0, landDelay);

  return (
    <div className="absolute z-0 -translate-x-1/2 -translate-y-1/2" style={{ left: `${PILE_POS.x}%`, top: `${PILE_POS.y}%` }}>
      <DirectionRing direction={direction} reduced={reduced} />

      <div className="relative flex items-center gap-6 md:gap-10">
        <div className="relative">
          <Deck count={pub.drawPileCount} size={size} canDraw={canDraw} onDraw={onDraw} deckRef={anchors.ref('deck')} />
          <ReshuffleSweep lastAction={pub.lastAction} pile={pile} topId={pub.topCard.id} size={size} reduced={reduced}
            onSwept={(keepId) => setPile((p) => p.filter((c) => c.id === keepId))} />
        </div>

        <div className="relative">
          {/* Four stacked glows: only opacity animates, so a colour change is a smooth cross-fade. */}
          {COLORS.map((c) => (
            <motion.div key={c} className="pointer-events-none absolute -inset-10 rounded-full"
              style={{ background: `radial-gradient(closest-side, ${COLOR_HEX[c]} 0%, ${COLOR_HEX[c]}88 45%, transparent 100%)` }}
              initial={false} animate={{ opacity: c === color ? 0.6 : 0 }} transition={{ duration: 0.5, ease: 'easeInOut' }} />
          ))}
          <div ref={anchors.ref('discard')} className="relative">
            <AnimatePresence initial={false}>
              {pile.map((card, i) => (
                // Flown cards appear exactly where their flight ended; anything else (a new game's
                // first card, reduced motion) drops in with a quick fade.
                <motion.div key={card.id} className={i === 0 ? 'relative' : 'absolute inset-0'}
                  style={{ rotate: tilt(card.id), visibility: hidden.has(card.id) ? 'hidden' : 'visible' }}
                  initial={hidden.has(card.id) ? false : { opacity: 0, scale: reduced ? 1 : 1.15 }}
                  animate={{ opacity: 1, scale: 1 }} transition={FADE}>
                  <CardFace card={card} size={size} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <StackBadge count={stack} />
        </div>
      </div>
    </div>
  );
}

/** Dashed direction ring: drifts slowly, and spins hard with a swoosh when play reverses. */
function DirectionRing({ direction, reduced }: { direction: 1 | -1; reduced: boolean }) {
  const drift = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (!reduced) drift.set((drift.get() + direction * delta * (360 / 14000)) % 360);
  });
  // Each reverse adds a fast 300° turn in the new direction on top of the drift.
  const [spin, setSpin] = useState(0);
  const [prev, setPrev] = useState(direction);
  if (prev !== direction) {
    setPrev(direction);
    setSpin((s) => s + direction * 300);
  }
  return (
    <motion.div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 md:h-80 md:w-80"
      initial={false} animate={{ rotate: spin }} transition={{ duration: 0.7, ease: EASE_OUT }}>
      <motion.div className="h-full w-full" style={{ rotate: drift }}>
        <svg viewBox="0 0 100 100" className="h-full w-full opacity-40">
          <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="6 5" />
          {[0, 120, 240].map((a) => (
            <g key={a} transform={`rotate(${a} 50 50)`}>
              <path d={direction === 1 ? 'M50 1 l5 3 -5 3z' : 'M50 1 l-5 3 5 3z'} fill="white" />
            </g>
          ))}
        </svg>
      </motion.div>
    </motion.div>
  );
}

function Deck({ count, size, canDraw, onDraw, deckRef }: { count: number; size: CardSize; canDraw: boolean; onDraw: () => void; deckRef: (el: HTMLElement | null) => void }) {
  // The stack gets thinner as the deck runs down; an empty deck is an outline.
  const layers = count >= 20 ? 3 : count >= 6 ? 2 : count > 0 ? 1 : 0;
  const low = count < 10;
  return (
    <button ref={deckRef} onClick={onDraw} disabled={!canDraw} className="relative block" aria-label={`Draw a card (${count} left)`}>
      {layers === 0 ? (
        <div className={`juan-card juan-card--${size}`} style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,.3)', background: 'transparent', boxShadow: 'none' }} />
      ) : (
        Array.from({ length: layers }, (_, k) => layers - 1 - k).map((i) => (
          <div key={i} className={i ? 'absolute' : 'relative'} style={{ top: -i * 3, left: -i * 2 }}>
            <CardBack size={size} />
          </div>
        ))
      )}
      {canDraw && (
        <motion.div className="absolute -inset-2 rounded-2xl ring-4 ring-yellow-300/80" animate={{ opacity: [0.4, 1, 0.4] }} transition={pulse(1.2)} />
      )}
      <span className={`absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold shadow ring-1 ${low ? 'bg-red-600/90 ring-red-300/60' : 'bg-black/60 ring-white/20'}`}>
        <motion.span key={count} className="inline-block tabular-nums" initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={SPRING_POP}>{count}</motion.span> left
      </span>
    </button>
  );
}

/** "+N" on the pile while a +2/+4 stack is live: pops on every stack, grows with it, pulses. */
function StackBadge({ count }: { count: number }) {
  const grow = 1 + Math.min(count, 16) / 24;
  return (
    <AnimatePresence>
      {count > 0 && (
        // Enter/exit and growth run on this element with finite transitions; the endless pulse is
        // on an inner one. (An infinite repeat on the presence element means its exit never ends.)
        <motion.div key="stack" className="absolute -right-6 -top-6 z-20"
          initial={{ scale: 0 }} animate={{ scale: grow }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }} transition={SPRING_POP}>
          <motion.div key={count} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={SPRING_POP}>
            <motion.div animate={{ scale: [1, 1.12, 1] }} transition={pulse(0.9)}
              className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-red-600 font-display text-xl shadow-xl ring-2 ring-white">
              +{count}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
