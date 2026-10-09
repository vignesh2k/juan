'use client';
import { AnimatePresence, motion } from 'motion/react';
import { COLOR_HEX } from '../Card';
import { COLORS, type Color } from '@/game/types';

export function ColorPicker({ open, onPick, onCancel }: { open: boolean; onPick: (c: Color) => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}
            className="rounded-3xl bg-[#1c1030] p-6 text-center shadow-2xl ring-1 ring-white/10">
            <p className="mb-4 font-display text-2xl">Pick a colour</p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((c) => (
                <motion.button key={c} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => onPick(c)}
                  className="h-20 w-20 rounded-2xl shadow-lg ring-4 ring-white/20" style={{ background: COLOR_HEX[c] }} aria-label={c} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
