'use client';
import { motion, type HTMLMotionProps } from 'motion/react';
import { CardBack, CardFace, type CardSize } from '../Card';
import type { Card } from '@/game/types';

const SIDE = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;

/**
 * A two-sided card: face at rotateY 0, back at rotateY 180. Animate `rotateY` from 180 to 0 to
 * flip it face up. `overlay` is drawn over the face side (and flips with it).
 */
export function FlipCard({ card, size, overlay, style, ...rest }: { card: Card; size: CardSize; overlay?: React.ReactNode } & HTMLMotionProps<'div'>) {
  return (
    <motion.div {...rest} className="relative w-fit" style={{ transformStyle: 'preserve-3d', transformPerspective: 700, ...style }}>
      <div className="relative" style={SIDE}><CardFace card={card} size={size} />{overlay}</div>
      <div className="absolute inset-0" style={{ ...SIDE, transform: 'rotateY(180deg)' }}><CardBack size={size} /></div>
    </motion.div>
  );
}
