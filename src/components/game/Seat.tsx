'use client';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CardBack } from '../Card';
import { avatarColor, avatarInitial } from '../Lobby';
import { useAnchors } from './anchors';
import { pageHidden } from './effects/timing';
import { DEAL_STAGGER_S, DRAW_FLY_S, DRAW_STAGGER_S, pulse, SPRING_POP } from './motion';
import { TurnRing } from './TurnRing';
import type { Pos } from './layout';
import type { PlayerPublic } from '@/game/types';

interface Props {
  player: PlayerPublic;
  pos: Pos;
  isTurn: boolean;
  deadline: number;
  catchable: boolean;
  compact: boolean;
  /** A fresh deal: the card count counts up from 0 as the cards arrive. */
  dealing: boolean;
  reduced: boolean;
  onCatch: () => void;
}

/** The card count as shown: climbs one card at a time (in step with cards flying in), drops at once. */
function useTickingCount(count: number, dealing: boolean, reduced: boolean) {
  const [shown, setShown] = useState(dealing && !reduced ? 0 : count);
  const settled = useRef(shown); // last count we came to rest at
  useEffect(() => {
    if (shown === count) {
      settled.current = shown;
      return;
    }
    if (shown > count || reduced || pageHidden()) return setShown(count);
    // The first card counts once it has (nearly) arrived; the rest follow at the stagger.
    const first = shown === settled.current;
    const ms = dealing ? (first ? 150 : DEAL_STAGGER_S * 1000) : first ? DRAW_FLY_S * 800 : DRAW_STAGGER_S * 1000;
    const t = setTimeout(() => setShown((s) => Math.min(count, s + 1)), ms);
    return () => clearTimeout(t);
  }, [shown, count, dealing, reduced]);
  return shown;
}

export function Seat({ player, pos, isTurn, deadline, catchable, compact, dealing, reduced, onCatch }: Props) {
  const anchors = useAnchors();
  const count = useTickingCount(player.cardCount, dealing, reduced);
  const badge = (
    <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 text-xs font-black text-black">
      <motion.span key={count} className="inline-block tabular-nums" initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={SPRING_POP}>{count}</motion.span>
    </span>
  );
  const avatar = (
    <motion.div animate={{ scale: isTurn ? 1.08 : 1 }}
      className={`grid place-items-center rounded-full font-display shadow-lg ring-2 ring-black/30 ${compact ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl'}`}
      style={{ background: avatarColor(player.id), boxShadow: isTurn ? '0 0 24px rgba(250,204,21,.8)' : undefined }}>
      {avatarInitial(player.name)}
    </motion.div>
  );
  const fan = Math.min(count, 6);
  return (
    <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      <div ref={anchors.ref(`seat:${player.id}`)} className="relative">
        {isTurn ? <TurnRing deadline={deadline} size={compact ? 50 : 58}>{avatar}</TurnRing> : <div className="p-[7px]">{avatar}</div>}
        {compact && badge}
      </div>
      <div className={`truncate rounded-full bg-black/55 px-2 font-bold ${compact ? 'max-w-[4.5rem] text-[11px] leading-4' : 'max-w-[5.5rem] text-xs'}`}>{player.name}</div>
      {!compact && (
        <div className="relative h-9 w-16">
          {Array.from({ length: fan }, (_, i) => (
            <div key={i} className="absolute left-1/2 top-0" style={{ transform: `translateX(${(i - (fan - 1) / 2) * 7 - 12}px) rotate(${(i - (fan - 1) / 2) * 8}deg)` }}>
              <CardBack size="xs" />
            </div>
          ))}
          {badge}
        </div>
      )}
      {player.calledJuan && player.cardCount <= 2 && <span className="font-display text-xs text-yellow-300">JUAN!</span>}
      {catchable && (
        <motion.button onClick={onCatch} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_POP}
          className="rounded-full bg-red-600 px-3 py-1 font-display text-sm shadow-lg">
          <motion.span className="block" animate={{ scale: [1, 1.15, 1] }} transition={pulse(0.6)}>CATCH!</motion.span>
        </motion.button>
      )}
    </div>
  );
}
