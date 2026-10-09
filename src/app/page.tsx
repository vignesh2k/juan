'use client';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CardFace } from '@/components/Card';
import { RulesButton } from '@/components/RulesButton';
import { toast } from '@/components/Toaster';
import { api } from '@/lib/api';
import { useUid } from '@/lib/useUid';
import { normalizeRoomCode, isValidRoomCode } from '@/game/roomCode';
import type { Card } from '@/game/types';

const HERO: Card[] = [
  { id: 'h1', color: 'red', value: '7' },
  { id: 'h2', color: null, value: 'wild4' },
  { id: 'h3', color: 'blue', value: 'reverse' },
  { id: 'h4', color: 'yellow', value: 'draw2' },
  { id: 'h5', color: 'green', value: 'skip' },
];

export default function Home() {
  const router = useRouter();
  const uid = useUid();
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setName(localStorage.getItem('juan:name') ?? ''); } catch {}
  }, []);

  async function go(kind: 'create' | 'join') {
    if (!name.trim()) return toast('Enter a nickname first');
    if (kind === 'join' && !isValidRoomCode(code)) return toast('Room codes are 5 letters/numbers');
    try { localStorage.setItem('juan:name', name.trim()); } catch {}
    setBusy(true);
    try {
      const res = await api<{ code: string }>(`room/${kind}`, { name, code });
      router.push(`/room/${res.code}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <RulesButton className="absolute right-4 top-4" />
      <div className="relative mb-6 h-40 w-72">
        {HERO.map((card, i) => (
          <motion.div key={card.id} className="absolute left-1/2 top-4"
            initial={{ y: 200, rotate: 0, opacity: 0 }}
            animate={{ y: Math.abs(i - 2) * 8, x: (i - 2) * 42 - 35, rotate: (i - 2) * 12, opacity: 1 }}
            transition={{ delay: 0.1 * i, type: 'spring', stiffness: 160, damping: 16 }}>
            <CardFace card={card} size="md" />
          </motion.div>
        ))}
      </div>
      <motion.h1 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: 'spring' }}
        className="font-display text-7xl tracking-wide text-yellow-300 drop-shadow-[0_6px_0_#b91c1c]">
        JUAN
      </motion.h1>
      <p className="mb-8 mt-2 text-white/70">The card game for chaotic friends</p>

      <div className="w-full max-w-sm space-y-3">
        <input className="input" placeholder="Your nickname" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
        {!joining ? (
          <>
            <button className="btn btn-red w-full" disabled={!uid || busy} onClick={() => go('create')}>Create room</button>
            <button className="btn btn-blue w-full" disabled={!uid || busy} onClick={() => setJoining(true)}>Join room</button>
          </>
        ) : (
          <>
            <input className="input text-center font-display text-3xl uppercase tracking-[0.4em]" placeholder="CODE" maxLength={5} autoFocus
              value={code} onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, 5))}
              onKeyDown={(e) => e.key === 'Enter' && go('join')} />
            <button className="btn btn-green w-full" disabled={!uid || busy || code.length !== 5} onClick={() => go('join')}>Join</button>
            <button className="w-full py-2 text-sm text-white/60 hover:text-white" onClick={() => setJoining(false)}>Back</button>
          </>
        )}
      </div>
    </main>
  );
}
