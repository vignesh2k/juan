'use client';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RulesButton } from './RulesButton';
import { toast } from './Toaster';
import { api } from '@/lib/api';
import type { RoomDoc } from '@/game/room';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/game/types';

export function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

export function Lobby({ room, uid }: { room: RoomDoc; uid: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isHost = room.hostId === uid;

  async function copy() {
    const link = `${location.origin}/room/${room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied');
    } catch {
      toast(link);
    }
  }

  async function run(path: string) {
    setBusy(true);
    try {
      await api(path, { code: room.code });
      if (path === 'room/leave') router.push('/');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-4 py-10">
      <RulesButton className="absolute right-4 top-4" />
      <p className="text-sm uppercase tracking-widest text-white/60">Room code</p>
      <button onClick={copy} className="mt-1 font-display text-6xl tracking-[0.3em] text-yellow-300 drop-shadow-[0_4px_0_#b91c1c]" title="Copy invite link">
        {room.code}
      </button>
      <p className="mt-2 text-sm text-white/60">Tap the code to copy an invite link</p>

      <div className="mt-8 w-full max-w-sm rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="mb-3 flex justify-between text-sm text-white/60">
          <span>Players</span>
          <span>{room.lobby.length}/{MAX_PLAYERS}</span>
        </div>
        <ul className="space-y-2">
          {room.lobby.map((p, i) => (
            <motion.li key={p.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
              <span className="grid h-9 w-9 place-items-center rounded-full font-display text-lg" style={{ background: avatarColor(p.id) }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="flex-1 font-semibold">{p.name}{p.id === uid && <span className="text-white/50"> (you)</span>}</span>
              {p.id === room.hostId && <span title="Host">👑</span>}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="mt-6 w-full max-w-sm space-y-3">
        {isHost ? (
          <button className="btn btn-green w-full" disabled={busy || room.lobby.length < MIN_PLAYERS} onClick={() => run('room/start')}>
            {room.lobby.length < MIN_PLAYERS ? 'Waiting for players…' : 'Start game'}
          </button>
        ) : (
          <p className="text-center text-white/70">Waiting for the host to start…</p>
        )}
        <button className="w-full py-2 text-sm text-white/60 hover:text-white" disabled={busy} onClick={() => run('room/leave')}>Leave room</button>
      </div>
    </main>
  );
}
