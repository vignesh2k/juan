'use client';
import { motion } from 'motion/react';
import { useState } from 'react';
import { COLOR_HEX } from '../../Card';
import { useAnchors, type Anchor } from '../anchors';
import { ME_POS, PILE_POS } from '../layout';
import { EASE_OUT, EFFECT_MS, EFFECT_S } from '../motion';
import { playerAfter, useLandingEffect, useTimers } from './timing';
import type { LastAction, PublicState } from '@/game/types';

type Fx =
  | { kind: 'skip'; key: string; at: Anchor; me: boolean }
  | { kind: 'reverse'; key: string; at: Anchor }
  | { kind: 'shock'; key: string; at: Anchor; color: string; big: boolean }
  | { kind: 'target'; key: string; at: Anchor; me: boolean; n: number }
  | { kind: 'jump'; key: string; at: Anchor; me: boolean };
type Kind = Fx['kind'];
type Slots = { [K in Kind]?: Extract<Fx, { kind: K }> };

interface Props {
  pub: PublicState;
  uid: string;
  reduced: boolean;
  /** Give the table a small jolt (a +4 landing). */
  onShake: () => void;
}

/**
 * One-shot power-card effects, for anyone's play, timed to the card landing on the pile:
 * Skip stamps ⊘ on the skipped player, Reverse pulses ⇄ at the pile, +2/+4 send a coloured
 * shockwave out of the pile and flash the player who now faces the stack, and a jump-in bursts
 * from the jumper. One slot per kind (a newer one replaces an older one), so fast play never
 * piles them up; nothing here takes pointer events.
 */
export function PowerEffects({ pub, uid, reduced, onShake }: Props) {
  const anchors = useAnchors();
  const later = useTimers();
  const [fx, setFx] = useState<Slots>({});

  const spotOf = (id: string) => (id === uid ? anchors.at('hand', ME_POS) : anchors.at(`seat:${id}`, PILE_POS));
  const show = (items: Fx[]) => {
    if (!items.length) return;
    setFx((cur) => ({ ...cur, ...Object.fromEntries(items.map((f) => [f.kind, f])) }));
    for (const f of items) later(() => setFx((cur) => (cur[f.kind]?.key === f.key ? { ...cur, [f.kind]: undefined } : cur)), EFFECT_MS + 150);
  };

  const onStart = (a: LastAction) => {
    if (a.type === 'jump') show([{ kind: 'jump', key: `${a.seq}`, at: spotOf(a.playerId), me: a.playerId === uid }]);
  };

  const onLand = (a: LastAction) => {
    if ((a.type !== 'play' && a.type !== 'jump') || !a.card) return;
    const key = `${a.seq}`;
    const pile = anchors.at('discard', PILE_POS);
    const items: Fx[] = [];
    switch (a.card.value) {
      case 'skip': {
        const skipped = playerAfter(pub.players, a.playerId, pub.direction);
        if (skipped !== a.playerId) items.push({ kind: 'skip', key, at: spotOf(skipped), me: skipped === uid });
        break;
      }
      case 'reverse':
        items.push({ kind: 'reverse', key, at: pile });
        break;
      case 'draw2':
      case 'wild4': {
        const color = COLOR_HEX[a.card.color ?? pub.currentColor];
        items.push({ kind: 'shock', key, at: pile, color, big: a.card.value === 'wild4' });
        if (pub.status === 'playing' && pub.pendingDraw) {
          const t = pub.turnPlayerId;
          items.push({ kind: 'target', key, at: spotOf(t), me: t === uid, n: pub.pendingDraw.count });
        }
        if (a.card.value === 'wild4' && !reduced) onShake();
        break;
      }
    }
    show(items);
  };

  useLandingEffect(pub.lastAction, reduced, onLand, onStart);

  return (
    <div className="pointer-events-none fixed inset-0 z-[46] overflow-hidden" aria-hidden>
      {fx.shock && <Shockwave key={`shock-${fx.shock.key}`} f={fx.shock} />}
      {fx.reverse && <ReversePulse key={`reverse-${fx.reverse.key}`} at={fx.reverse.at} />}
      {fx.target && <TargetFlash key={`target-${fx.target.key}`} f={fx.target} />}
      {fx.skip && <SkipStamp key={`skip-${fx.skip.key}`} at={fx.skip.at} me={fx.skip.me} />}
      {fx.jump && <JumpBurst key={`jump-${fx.jump.key}`} at={fx.jump.at} me={fx.jump.me} />}
    </div>
  );
}

/** Absolutely positioned box of `size` px centred on `at`. */
const centred = (at: Anchor, size: number) => ({ left: at.x - size / 2, top: at.y - size / 2, width: size, height: size });

function SkipStamp({ at, me }: { at: Anchor; me: boolean }) {
  const size = me ? 120 : 76;
  return (
    <motion.div className="absolute" style={centred(at, size)}
      initial={{ scale: 2.4, opacity: 0, rotate: -25 }}
      animate={{ scale: [2.4, 0.92, 1, 1, 1, 1, 1], opacity: [0, 1, 1, 1, 1, 1, 0], rotate: [-25, 0, 0, 0, 0, 0, 0], x: [0, 0, -7, 7, -4, 0, 0] }}
      transition={{ duration: EFFECT_S, times: [0, 0.2, 0.3, 0.4, 0.5, 0.6, 1], ease: 'easeOut' }}>
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_4px_8px_rgba(0,0,0,.6)]">
        <circle cx="50" cy="50" r="40" fill="rgba(0,0,0,.35)" stroke="#ef4444" strokeWidth="12" />
        <line x1="22" y1="78" x2="78" y2="22" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

function ReversePulse({ at }: { at: Anchor }) {
  return (
    <>
      <motion.div className="absolute rounded-full border-4 border-emerald-300" style={centred(at, 200)}
        initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} />
      <motion.div className="absolute grid place-items-center font-display text-7xl text-emerald-300 [text-shadow:0_4px_0_#064e3b]" style={centred(at, 120)}
        initial={{ scale: 0.4, opacity: 0, rotate: -90 }} animate={{ scale: [0.4, 1.4, 1.6], opacity: [0, 1, 0], rotate: [-90, 0, 20] }}
        transition={{ duration: 0.7, times: [0, 0.45, 1], ease: EASE_OUT }}>
        ⇄
      </motion.div>
    </>
  );
}

function Shockwave({ f }: { f: Extract<Fx, { kind: 'shock' }> }) {
  return (
    <>
      {[0, 1].map((i) => (
        <motion.div key={i} className="absolute rounded-full" style={{ ...centred(f.at, 160), border: `${i ? 4 : 8}px solid ${f.color}`, boxShadow: `0 0 24px ${f.color}` }}
          initial={{ scale: 0.3, opacity: 0.95 }} animate={{ scale: f.big ? 3.4 : 2.6, opacity: 0 }}
          transition={{ duration: 0.65, delay: i * 0.1, ease: EASE_OUT }} />
      ))}
    </>
  );
}

function TargetFlash({ f }: { f: Extract<Fx, { kind: 'target' }> }) {
  return (
    <>
      {f.me ? (
        <motion.div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-t from-red-600/70 to-transparent"
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 0] }} transition={{ duration: EFFECT_S, times: [0, 0.2, 0.5, 1] }} />
      ) : (
        <motion.div className="absolute rounded-full bg-[radial-gradient(circle,rgba(239,68,68,.9)_0%,rgba(239,68,68,.35)_45%,transparent_70%)]" style={centred(f.at, 130)}
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.25, 1.1, 1.4], opacity: [0, 1, 0.7, 0] }}
          transition={{ duration: EFFECT_S, times: [0, 0.25, 0.55, 1] }} />
      )}
      <motion.div className="absolute -translate-x-1/2 rounded-full bg-red-600 px-3 py-0.5 font-display text-lg shadow-lg ring-2 ring-white"
        style={{ left: f.at.x, top: f.at.y - (f.me ? 90 : 52) }}
        initial={{ y: 12, opacity: 0, scale: 0.6 }} animate={{ y: [12, -6, -16], opacity: [0, 1, 0], scale: [0.6, 1.1, 1] }}
        transition={{ duration: EFFECT_S, times: [0, 0.3, 1], ease: EASE_OUT }}>
        +{f.n} ⬇
      </motion.div>
    </>
  );
}

function JumpBurst({ at, me }: { at: Anchor; me: boolean }) {
  const spot = me ? { ...at, y: at.y - 40 } : at;
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        // Static rotation on the wrapper, so each ray's y travel points outward along its angle.
        <div key={i} className="absolute h-0 w-0" style={{ left: spot.x, top: spot.y, transform: `rotate(${i * 45}deg)` }}>
          <motion.div className="absolute -left-[3px] -top-[14px] h-7 w-1.5 rounded-full bg-yellow-300"
            initial={{ opacity: 0, y: 0, scaleY: 0.4 }}
            animate={{ opacity: [0, 1, 0], y: [0, -46], scaleY: [0.4, 1.2, 0.6] }}
            transition={{ duration: 0.55, ease: EASE_OUT }} />
        </div>
      ))}
      <motion.div className="absolute grid place-items-center text-5xl" style={centred(spot, 80)}
        initial={{ scale: 0.2, opacity: 0, rotate: -20 }} animate={{ scale: [0.2, 1.3, 1], opacity: [0, 1, 0], rotate: [-20, 8, 0] }}
        transition={{ duration: 0.75, times: [0, 0.35, 1] }}>
        ⚡
      </motion.div>
      <motion.div className="absolute -translate-x-1/2 whitespace-nowrap rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-700 px-3 py-1 font-display text-xl shadow-xl ring-2 ring-yellow-300"
        style={{ left: spot.x, top: spot.y + (me ? -80 : 34) }}
        initial={{ scale: 0.3, opacity: 0, rotate: -10 }} animate={{ scale: [0.3, 1.15, 1, 1], opacity: [0, 1, 1, 0], rotate: [-10, -4, -4, -4] }}
        transition={{ duration: EFFECT_S, times: [0, 0.3, 0.7, 1] }}>
        JUMP IN!
      </motion.div>
    </>
  );
}
