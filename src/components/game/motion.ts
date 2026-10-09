import type { Transition } from 'motion/react';

/**
 * Shared motion vocabulary for the game table: one easing family (fast out, soft landing) and a
 * handful of springs/durations, so plays, draws, deals and effects all feel like the same table.
 * Animate transforms and opacity only.
 */

type Bezier = [number, number, number, number];
/** Quick start, long soft settle. The default for anything that travels. */
export const EASE_OUT: Bezier = [0.22, 1, 0.36, 1];
/** Symmetric, for flips and wiggles. */
export const EASE_IN_OUT: Bezier = [0.65, 0, 0.35, 1];

/** A played card's flight from its owner to the pile. Effects tied to the landing wait this long. */
export const FLY_S = 0.5;
export const FLY_MS = FLY_S * 1000;
/** A drawn card's flight from the deck to a player. */
export const DRAW_FLY_S = 0.45;
/** Gap between cards when several are drawn at once. */
export const DRAW_STAGGER_S = 0.07;
/** Gap between cards while dealing a fresh hand. */
export const DEAL_STAGGER_S = 0.09;
/** Upper bound for one-shot table effects (stamps, shockwaves, washes). */
export const EFFECT_S = 0.8;
export const EFFECT_MS = EFFECT_S * 1000;
export const BANNER_MS = 1300;

/** Played card travelling to the pile: arrives on time with a slight overshoot. */
export const SPRING_LAND: Transition = { type: 'spring', visualDuration: FLY_S, bounce: 0.28 };
/** Cards settling into the hand fan. */
export const SPRING_HAND: Transition = { type: 'spring', visualDuration: 0.35, bounce: 0.15 };
/** Badges and counters popping. */
export const SPRING_POP: Transition = { type: 'spring', visualDuration: 0.25, bounce: 0.45 };
/** Short, plain fade (also the reduced-motion fallback). */
export const FADE: Transition = { duration: 0.2, ease: 'easeOut' };

/** An endless pulse. Only ever put this on an element that is not itself entering/leaving. */
export const pulse = (duration: number): Transition => ({ repeat: Infinity, duration, ease: 'easeInOut' });
