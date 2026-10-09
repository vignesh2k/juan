'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const RULES: [string, string][] = [
  ['Goal', 'Be the first to get rid of all your cards. No scoring — first out wins.'],
  ['Players', '2–8 players. Share the room code to invite friends — you can join a room in the lobby or between games.'],
  ['Matching', 'Play a card that matches the top card by colour or by number/symbol, or play a Wild.'],
  ['Wild', 'A plain Wild goes on anything — you pick the next colour.'],
  ['+4 any time', 'A Wild +4 can be played on anything (you pick the colour) — except on a +2 stack.'],
  ['Stacking', 'Hit with a +2? Stack another +2 (any colour) to pass it on, growing the total. Same for +4 on +4. You can NOT mix: no +4 on a +2, no +2 on a +4. Can’t stack? Draw the whole total and lose your turn.'],
  ['Jump in', 'Have the EXACT same card as the top card (same colour and number/symbol)? Play it any time, even when it’s not your turn. Everyone between is skipped and play continues from you. Works on stacks too.'],
  ['Jumping with wilds', 'A Wild on a Wild, or a +4 on a +4, counts as the exact same card — jump in and pick a new colour. As with any jump, the card’s effect (Skip, +2, +4…) kicks in from you.'],
  ['Drawing', 'Can’t or don’t want to play? Draw 1. If it’s playable you may play it right away, otherwise your turn passes.'],
  ['Empty draw pile', 'When the draw pile runs out, the discard pile (minus the top card) is shuffled into a new one.'],
  ['Skip / Reverse', 'Skip jumps the next player. Reverse flips direction (with 2 players it acts like a Skip).'],
  ['Juan!', 'Holding 2 cards and about to play one of them (on your turn, or jumping in)? Press JUAN! first. If you reach 1 card without calling it, anyone can hit CATCH and you draw 2 — but only until the next move, when the chance to catch you closes. Forgot? Press JUAN! straight after playing to save yourself before someone catches you.'],
  ['No power finish', 'You can’t finish on a power card (Skip, Reverse, +2, Wild, +4). If you play one as your last card it still takes effect, but you draw 1 card.'],
  ['Turn timer', 'You have 30 seconds per turn. Run out and you automatically draw (or take the stack) and your turn passes.'],
];

export function RulesButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // portal targets document.body, which only exists on the client
  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#1c1030] p-6 shadow-2xl ring-1 ring-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-3xl">How to play Juan</h2>
              <button onClick={() => setOpen(false)} className="text-2xl text-white/60 hover:text-white" aria-label="Close">✕</button>
            </div>
            <ul className="space-y-3">
              {RULES.map(([title, text]) => (
                <li key={title} className="rounded-2xl bg-white/5 p-3">
                  <div className="font-display text-lg text-yellow-300">{title}</div>
                  <p className="text-sm leading-relaxed text-white/85">{text}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return (
    <>
      <button aria-label="How to play" onClick={() => setOpen(true)}
        className={`grid h-10 w-10 place-items-center rounded-full bg-white/10 font-display text-xl ring-1 ring-white/20 backdrop-blur hover:bg-white/20 ${className}`}>
        ?
      </button>
      {/* Portalled so the modal isn't trapped in a parent's stacking context (e.g. the game's top bar). */}
      {mounted && createPortal(modal, document.body)}
    </>
  );
}
