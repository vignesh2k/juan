'use client';
import { useEffect, useState } from 'react';
import { toast } from './Toaster';
import { api } from '@/lib/api';

export function JoinPrompt({ code }: { code: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try { setName(localStorage.getItem('juan:name') ?? ''); } catch {}
  }, []);

  async function join() {
    if (!name.trim()) return toast('Enter a nickname first');
    try { localStorage.setItem('juan:name', name.trim()); } catch {}
    setBusy(true);
    try {
      await api('room/join', { code, name });
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <p className="text-white/70">You&apos;ve been invited to room</p>
      <p className="font-display text-5xl tracking-[0.3em] text-yellow-300">{code}</p>
      <div className="w-full max-w-sm space-y-3">
        <input className="input" placeholder="Your nickname" maxLength={16} value={name} autoFocus
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} />
        <button className="btn btn-green w-full" disabled={busy} onClick={join}>Join game</button>
      </div>
    </main>
  );
}
