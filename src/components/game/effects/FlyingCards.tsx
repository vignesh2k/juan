'use client';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CardBack, type CardSize } from '../../Card';
import { useAnchors, type Anchor } from '../anchors';
import { FlipCard } from '../FlipCard';
import { ME_POS, PILE_POS } from '../layout';
import { DEAL_STAGGER_S, DRAW_FLY_S, DRAW_STAGGER_S, EASE_IN_OUT, EASE_OUT, FLY_MS, FLY_S, SPRING_LAND } from '../motion';
import { tilt } from '../tilt';
import { pageHidden, useTimers } from './timing';
import { useChangeEffect } from '@/lib/hooks';
import type { Card, LastAction, PublicState } from '@/game/types';

/** A played card flying from its owner to the pile. Coordinates are the card's top-left, in px. */
interface PlayFlight { key: string; card: Card; from: Anchor; fromScale: number; faceDown: boolean; to: Anchor; toRot: number }
/** A face-down card flying from the deck to an opponent's seat. */
interface DrawFlight { key: string; from: Anchor; to: Anchor; delay: number; rot: number }

const MAX_PLAYS = 3;
const MAX_DRAWS = 24;

/** Opponents that drew because of this action (your own draws arrive in your hand instead). */
function drawsFor(a: LastAction): { target: string; n: number } | null {
  if (a.type === 'catch') return { target: a.targetId ?? '', n: a.n ?? 0 };
  if (a.type === 'draw' || a.type === 'stackDraw' || a.type === 'timeout') return { target: a.playerId, n: a.n ?? 0 };
  if (a.penalty) return { target: a.playerId, n: 1 };
  return null;
}

interface Props {
  pub: PublicState;
  uid: string;
  size: CardSize;
  reduced: boolean;
  /** A played card took off; keep it hidden on the pile (and in the hand) until it lands. */
  onFlightStart: (cardId: string) => void;
  onFlightEnd: (cardId: string) => void;
}

/**
 * Fixed overlay above the table that animates real cards between measured on-screen spots:
 * plays fly from the player (seat, or the card's slot in your hand) to the pile; opponents'
 * draws fly from the deck to their seat; a fresh deal sends cards out to every opponent.
 */
export function FlyingCards({ pub, uid, size, reduced, onFlightStart, onFlightEnd }: Props) {
  const anchors = useAnchors();
  const later = useTimers();
  const [plays, setPlays] = useState<PlayFlight[]>([]);
  const [draws, setDraws] = useState<DrawFlight[]>([]);
  const playsRef = useRef(plays);
  useEffect(() => { playsRef.current = plays; });

  const seatOf = (id: string) => (id === uid ? anchors.at('hand', ME_POS) : anchors.at(`seat:${id}`, PILE_POS));

  function launchPlay(a: LastAction) {
    const card = a.card!;
    const to = anchors.get('discard');
    if (!to) return;
    const mine = a.playerId === uid;
    const from = mine ? anchors.get(`card:${card.id}`) ?? anchors.at('hand', ME_POS) : seatOf(a.playerId);
    const flight: PlayFlight = { key: `${a.seq}`, card, from, to, fromScale: mine ? 1 : 0.35, faceDown: !mine, toRot: tilt(card.id) };
    // Never more than a few in the air: the oldest lands on the spot.
    const overflow = playsRef.current.slice(0, Math.max(0, playsRef.current.length - MAX_PLAYS + 1));
    overflow.forEach((f) => onFlightEnd(f.card.id));
    setPlays((ps) => [...ps.filter((p) => !overflow.includes(p)), flight]);
    onFlightStart(card.id);
    // Belt and braces: never leave a card in the air (or hidden on the pile) if a flight is cut short.
    later(() => land(flight), FLY_MS * 3);
  }

  function land(f: PlayFlight) {
    setPlays((ps) => ps.filter((x) => x.key !== f.key));
    onFlightEnd(f.card.id);
  }

  function launchDraws(targets: { id: string; n: number }[], stagger: number, delay0: number, seq: number) {
    const from = anchors.get('deck');
    if (!from) return;
    const fresh: DrawFlight[] = [];
    const most = Math.max(0, ...targets.map((t) => t.n));
    // Round-robin (like a dealer) so several seats fill up together.
    for (let round = 0; round < most; round++) {
      targets.forEach((t, k) => {
        if (round >= t.n || t.id === uid) return;
        const i = fresh.length;
        fresh.push({ key: `${seq}-${t.id}-${round}`, from, to: seatOf(t.id), delay: delay0 + i * stagger, rot: (k % 2 ? 1 : -1) * (8 + round * 3) });
      });
    }
    if (!fresh.length) return;
    setDraws((ds) => [...ds, ...fresh].slice(-MAX_DRAWS));
    const keys = new Set(fresh.map((f) => f.key));
    later(() => setDraws((ds) => ds.filter((d) => !keys.has(d.key))), (fresh[fresh.length - 1].delay + DRAW_FLY_S) * 1000 + 1000);
  }

  function launchDeal(a: LastAction) {
    launchDraws(pub.players.map((p) => ({ id: p.id, n: Math.min(p.cardCount, 3) })), DEAL_STAGGER_S / 2, 0.1, a.seq);
  }

  function launch(a: LastAction) {
    if (reduced || pageHidden()) return;
    if (a.type === 'start') return launchDeal(a);
    if ((a.type === 'play' || a.type === 'jump') && a.card) launchPlay(a);
    const d = drawsFor(a);
    // A power-card finish draws its penalty card after the card lands.
    if (d && d.n > 0) launchDraws([{ id: d.target, n: Math.min(d.n, 8) }], DRAW_STAGGER_S, a.penalty ? FLY_S : 0, a.seq);
  }

  useChangeEffect(pub.lastAction.seq, () => launch(pub.lastAction));
  // Mounting straight into a fresh game (from the lobby): deal to the opponents' seats.
  const dealt = useRef(false);
  useEffect(() => {
    if (dealt.current) return;
    dealt.current = true;
    if (pub.lastAction.type === 'start') launch(pub.lastAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduced) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-hidden>
      {draws.map((f) => (
        <motion.div key={f.key} className="absolute left-0 top-0"
          initial={{ x: f.from.x - f.from.w / 2, y: f.from.y - f.from.h / 2, scale: 1, rotate: 0, opacity: 1 }}
          animate={{ x: f.to.x - f.from.w / 2, y: f.to.y - f.from.h / 2, scale: 0.4, rotate: f.rot, opacity: [1, 1, 0] }}
          transition={{ duration: DRAW_FLY_S, delay: f.delay, ease: EASE_OUT, opacity: { duration: DRAW_FLY_S, delay: f.delay, times: [0, 0.8, 1] } }}
          onAnimationComplete={() => setDraws((ds) => ds.filter((x) => x.key !== f.key))}>
          <CardBack size={size} />
        </motion.div>
      ))}
      {plays.map((f) => (
        <motion.div key={f.key} className="absolute left-0 top-0"
          initial={{ x: f.from.x - f.to.w / 2, y: f.from.y - f.to.h / 2, rotate: f.from.rot + (f.faceDown ? -30 : 0), scale: f.fromScale }}
          animate={{ x: f.to.x - f.to.w / 2, y: f.to.y - f.to.h / 2, rotate: f.toRot, scale: [f.fromScale, 1.08, 1] }}
          transition={{ default: SPRING_LAND, scale: { duration: FLY_S, times: [0, 0.75, 1], ease: 'easeInOut' } }}
          onAnimationComplete={() => land(f)}>
          <FlipCard card={f.card} size={size}
            initial={{ rotateY: f.faceDown ? 180 : 0 }} animate={{ rotateY: 0 }}
            transition={{ duration: FLY_S * 0.45, delay: FLY_S * 0.2, ease: EASE_IN_OUT }} />
        </motion.div>
      ))}
    </div>
  );
}
