'use client';
import { createContext, useContext, useState } from 'react';
import type { Pos } from './layout';

/** Viewport-pixel centre and size of a table element, plus its fan tilt (data-rot) if any. */
export interface Anchor { x: number; y: number; w: number; h: number; rot: number }

/**
 * A tiny registry of on-screen elements (deck, discard pile, seats, hand, hand cards) so effects
 * can measure real pixel positions instead of guessing from percentages.
 */
export interface Anchors {
  /** Stable ref callback that registers an element under `id`. */
  ref(id: string): (el: HTMLElement | null) => void;
  /** Measures `id` now; falls back to its last measured spot once it has unmounted. */
  get(id: string): Anchor | null;
  /** Like `get`, but falls back to a percentage position when the element was never seen. */
  at(id: string, fallback: Pos): Anchor;
}

function createAnchors(): Anchors {
  const els = new Map<string, HTMLElement>();
  const last = new Map<string, Anchor>();
  const refs = new Map<string, (el: HTMLElement | null) => void>();
  const measure = (id: string): Anchor | null => {
    const el = els.get(id);
    if (!el?.isConnected) return last.get(id) ?? null;
    const r = el.getBoundingClientRect();
    const a = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: el.offsetWidth, h: el.offsetHeight, rot: Number(el.dataset.rot ?? 0) };
    last.set(id, a);
    return a;
  };
  return {
    ref(id) {
      let fn = refs.get(id);
      if (!fn) {
        fn = (el) => {
          if (el) els.set(id, el);
          else {
            measure(id); // remember where it was, for a flight that starts just after it left
            els.delete(id);
          }
        };
        refs.set(id, fn);
      }
      return fn;
    },
    get: measure,
    at(id, fallback) {
      return measure(id) ?? { x: (fallback.x / 100) * window.innerWidth, y: (fallback.y / 100) * window.innerHeight, w: 0, h: 0, rot: 0 };
    },
  };
}

const AnchorsContext = createContext<Anchors | null>(null);

export function AnchorsProvider({ children }: { children: React.ReactNode }) {
  const [anchors] = useState(createAnchors);
  return <AnchorsContext.Provider value={anchors}>{children}</AnchorsContext.Provider>;
}

export function useAnchors(): Anchors {
  const a = useContext(AnchorsContext);
  if (!a) throw new Error('useAnchors needs an AnchorsProvider');
  return a;
}
