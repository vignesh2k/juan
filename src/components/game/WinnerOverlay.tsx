'use client';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { COLOR_HEX } from '../Card';
import { COLORS } from '@/game/types';

interface Props {
  winnerName: string;
  isMe: boolean;
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function WinnerOverlay({ winnerName, isMe, isHost, busy, onPlayAgain, onLeave }: Props) {
  const confetti = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 1.5, dur: 2.5 + Math.random() * 2,
      color: COLOR_HEX[COLORS[i % 4]], rot: Math.random() * 720 - 360,
    })),
    [],
  );
  return (
    <motion.div className="fixed inset-0 z-[85] grid place-items-center overflow-hidden bg-black/70 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {confetti.map((c, i) => (
        <motion.div key={i} className="absolute top-0 h-3 w-2 rounded-sm" style={{ left: `${c.left}%`, background: c.color }}
          initial={{ y: '-5vh', rotate: 0 }} animate={{ y: '110vh', rotate: c.rot }}
          transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }} />
      ))}
      <motion.div initial={{ scale: 0.5, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="relative w-full max-w-sm rounded-3xl bg-[#1c1030] p-8 text-center shadow-2xl ring-1 ring-white/10">
        <div className="text-6xl">🏆</div>
        <h2 className="mt-2 font-display text-4xl text-yellow-300">{isMe ? 'You win!' : `${winnerName} wins!`}</h2>
        <div className="mt-6 space-y-3">
          {isHost ? (
            <button className="btn btn-green w-full" disabled={busy} onClick={onPlayAgain}>Play again</button>
          ) : (
            <p className="text-white/70">Waiting for the host to start a new game…</p>
          )}
          <button className="w-full py-2 text-sm text-white/60 hover:text-white" onClick={onLeave}>Leave room</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
