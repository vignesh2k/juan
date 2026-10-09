'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

const listeners = new Set<(msg: string) => void>();
export const toast = (msg: string) => listeners.forEach((l) => l(msg));

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const listener = (msg: string) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { id, msg }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2800);
    };
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl bg-black/80 px-4 py-2 text-center text-sm font-semibold shadow-xl ring-1 ring-white/10">
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
