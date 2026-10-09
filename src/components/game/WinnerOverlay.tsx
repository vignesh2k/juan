'use client';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { COLOR_HEX } from '../Card';
import { avatarColor, avatarInitial, copyInviteLink } from '../Lobby';
import { COLORS, MAX_PLAYERS, type Player } from '@/game/types';

interface Props {
  code: string;
  uid: string;
  /** Who's in the room for the next game. */
  lobby: Player[];
  /** Lobby members who walked away last game and won't be dealt in. */
  away: Set<string>;
  winnerName: string;
  isMe: boolean;
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function WinnerOverlay({ code, uid, lobby, away, winnerName, isMe, isHost, busy, onPlayAgain, onLeave }: Props) {
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
        className="relative max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-[#1c1030] p-6 text-center sm:p-8 shadow-2xl ring-1 ring-white/10">
        <div className="text-6xl">🏆</div>
        <h2 className="mt-2 font-display text-4xl text-yellow-300">{isMe ? 'You win!' : `${winnerName} wins!`}</h2>
        <div className="mt-5 rounded-2xl bg-white/5 p-3 text-left ring-1 ring-white/10">
          <div className="mb-2 flex justify-between text-xs uppercase tracking-wider text-white/60">
            <span>Next game</span>
            <span>{lobby.length}/{MAX_PLAYERS}</span>
          </div>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {lobby.map((p) => (
              <li key={p.id} className={`flex items-center gap-2 text-sm ${away.has(p.id) ? 'opacity-50' : ''}`}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-xs" style={{ background: avatarColor(p.id) }}>
                  {avatarInitial(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {p.name}{p.id === uid && <span className="text-white/50"> (you)</span>}
                </span>
                {away.has(p.id) && <span className="text-xs text-white/60">away</span>}
              </li>
            ))}
          </ul>
          <button className="mt-3 w-full rounded-full bg-white/10 py-1.5 text-sm font-bold hover:bg-white/20" onClick={() => copyInviteLink(code)}>
            Copy invite link
          </button>
        </div>
        <div className="mt-5 space-y-3">
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
