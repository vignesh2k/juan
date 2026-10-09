'use client';
import { useEffect, useRef, useState } from 'react';
import { FLY_MS } from '../motion';
import { useChangeEffect } from '@/lib/hooks';
import type { LastAction, PlayerPublic } from '@/game/types';

/**
 * True while the page is in a background tab. Browsers pause animation frames there, so effects
 * started then would all replay at once on return: skip them instead.
 */
export const pageHidden = () => typeof document !== 'undefined' && document.hidden;

export const isPlay = (a: LastAction) => (a.type === 'play' || a.type === 'jump') && !!a.card;

/** How long after the snapshot this action's card lands on the pile (0 when nothing flies). */
export function landDelayMs(a: LastAction, reduced: boolean): number {
  return !reduced && isPlay(a) ? FLY_MS : 0;
}

/** The seat `steps` places after `fromId` in play order. */
export function playerAfter(players: PlayerPublic[], fromId: string, direction: 1 | -1, steps = 1): string {
  const n = players.length;
  const i = players.findIndex((p) => p.id === fromId);
  return players[(((i + direction * steps) % n) + n) % n]?.id ?? fromId;
}

/**
 * Runs `onLand` once per new action (never on mount, never again on re-render or reconnect),
 * after the played card lands, plus `onStart` straight away. Pending landings are dropped on
 * unmount. Callers keep one slot per effect kind, so fast actions replace rather than pile up.
 */
export function useLandingEffect(
  a: LastAction, reduced: boolean,
  onLand: (a: LastAction) => void, onStart?: (a: LastAction) => void,
) {
  const later = useTimers();
  useChangeEffect(a.seq, () => {
    if (pageHidden()) return;
    onStart?.(a);
    const d = landDelayMs(a, reduced);
    if (d === 0) onLand(a);
    else later(() => onLand(a), d);
  });
}

/** `value`, but each change shows up `delayMs` later (immediately when 0). */
export function useDelayedValue<T>(value: T, delayMs: number): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (Object.is(value, shown)) return;
    const t = setTimeout(() => setShown(value), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);
  return shown;
}

/** Calls `fn` after `ms`, cancelling everything still pending on unmount. */
export function useTimers() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = timers.current;
    return () => { set.forEach(clearTimeout); set.clear(); };
  }, []);
  return useRef((fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  }).current;
}
