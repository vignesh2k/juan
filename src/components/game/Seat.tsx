'use client';
import { motion } from 'motion/react';
import { CardBack } from '../Card';
import { avatarColor } from '../Lobby';
import { TurnRing } from './TurnRing';
import type { Pos } from './layout';
import type { PlayerPublic } from '@/game/types';

interface Props {
  player: PlayerPublic;
  pos: Pos;
  isTurn: boolean;
  deadline: number;
  catchable: boolean;
  onCatch: () => void;
}

export function Seat({ player, pos, isTurn, deadline, catchable, onCatch }: Props) {
  const avatar = (
    <motion.div animate={{ scale: isTurn ? 1.08 : 1 }}
      className="grid h-11 w-11 place-items-center rounded-full font-display text-xl shadow-lg ring-2 ring-black/30"
      style={{ background: avatarColor(player.id), boxShadow: isTurn ? '0 0 24px rgba(250,204,21,.8)' : undefined }}>
      {player.name[0]?.toUpperCase()}
    </motion.div>
  );
  const fan = Math.min(player.cardCount, 6);
  return (
    <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      {isTurn ? <TurnRing deadline={deadline} size={58}>{avatar}</TurnRing> : <div className="p-[7px]">{avatar}</div>}
      <div className="max-w-[5.5rem] truncate rounded-full bg-black/55 px-2 text-xs font-bold">{player.name}</div>
      <div className="relative h-9 w-16">
        {Array.from({ length: fan }, (_, i) => (
          <div key={i} className="absolute left-1/2 top-0" style={{ transform: `translateX(${(i - (fan - 1) / 2) * 7 - 12}px) rotate(${(i - (fan - 1) / 2) * 8}deg)` }}>
            <CardBack size="xs" />
          </div>
        ))}
        <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 text-xs font-black text-black">{player.cardCount}</span>
      </div>
      {player.calledJuan && player.cardCount <= 2 && <span className="font-display text-xs text-yellow-300">JUAN!</span>}
      {catchable && (
        <motion.button onClick={onCatch} animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
          className="rounded-full bg-red-600 px-3 py-1 font-display text-sm shadow-lg">
          CATCH!
        </motion.button>
      )}
    </div>
  );
}
