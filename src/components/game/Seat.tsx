'use client';
import { motion } from 'motion/react';
import { CardBack } from '../Card';
import { avatarColor, avatarInitial } from '../Lobby';
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
  onCatch: () => void;
}

export function Seat({ player, pos, isTurn, deadline, catchable, compact, onCatch }: Props) {
  const badge = <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 text-xs font-black text-black">{player.cardCount}</span>;
  const avatar = (
    <motion.div animate={{ scale: isTurn ? 1.08 : 1 }}
      className={`grid place-items-center rounded-full font-display shadow-lg ring-2 ring-black/30 ${compact ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl'}`}
      style={{ background: avatarColor(player.id), boxShadow: isTurn ? '0 0 24px rgba(250,204,21,.8)' : undefined }}>
      {avatarInitial(player.name)}
    </motion.div>
  );
  const fan = Math.min(player.cardCount, 6);
  return (
    <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      <div className="relative">
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
        <motion.button onClick={onCatch} initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="rounded-full bg-red-600 px-3 py-1 font-display text-sm shadow-lg">
          <motion.span className="block" animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}>CATCH!</motion.span>
        </motion.button>
      )}
    </div>
  );
}
