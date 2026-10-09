'use client';
import { motion } from 'motion/react';
import { useState } from 'react';
import { COLOR_HEX } from '../../Card';
import { useAnchors } from '../anchors';
import { PILE_POS } from '../layout';
import { EASE_OUT, EFFECT_MS, EFFECT_S } from '../motion';
import { useLandingEffect, useTimers } from './timing';
import type { PublicState } from '@/game/types';

/**
 * When a Wild or +4 lands, a ripple of the chosen colour spreads from the pile across the felt.
 * Sits just above the felt and below every card, and takes no pointer events.
 */
export function ColorWash({ pub, reduced }: { pub: PublicState; reduced: boolean }) {
  const anchors = useAnchors();
  const later = useTimers();
  const [wash, setWash] = useState<{ key: number; x: number; y: number; color: string } | null>(null);

  useLandingEffect(pub.lastAction, reduced, (a) => {
    if ((a.type !== 'play' && a.type !== 'jump') || (a.card?.value !== 'wild' && a.card?.value !== 'wild4')) return;
    const at = anchors.at('discard', PILE_POS);
    setWash({ key: a.seq, x: at.x, y: at.y, color: COLOR_HEX[pub.currentColor] });
    later(() => setWash((w) => (w?.key === a.seq ? null : w)), EFFECT_MS + 150);
  });

  if (!wash) return null;
  const d = 2.2 * Math.max(window.innerWidth, window.innerHeight);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div key={wash.key} className="absolute rounded-full"
        style={{ left: wash.x - d / 2, top: wash.y - d / 2, width: d, height: d,
          background: `radial-gradient(circle, transparent 0%, ${wash.color}aa 30%, ${wash.color}55 45%, transparent 62%)` }}
        initial={{ scale: 0.05, opacity: 0.9 }} animate={{ scale: 1, opacity: [0.9, 0.7, 0] }}
        transition={{ duration: EFFECT_S, ease: EASE_OUT, opacity: { duration: EFFECT_S, times: [0, 0.5, 1] } }} />
    </div>
  );
}
