'use client';
import { useEffect, useRef, useState } from 'react';

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Runs `effect` whenever `key` changes after mount — never on the first run, so a component
 * mounting mid-game doesn't replay what already happened. StrictMode's double effect run is ignored.
 */
export function useChangeEffect(key: number, effect: () => void) {
  const seen = useRef<number | null>(null); // null until mounted
  useEffect(() => {
    const prev = seen.current;
    seen.current = key;
    if (prev !== null && prev !== key) effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function useViewport() {
  const [size, setSize] = useState(() =>
    typeof window === 'undefined' ? { width: 1024, height: 768 } : { width: window.innerWidth, height: window.innerHeight },
  );
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}
