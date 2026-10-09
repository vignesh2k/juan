import { COLORS, NUMBER_VALUES, type Card, type Color, type Rng, type Value } from './types';

export function createDeck(): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (color: Color | null, value: Value) => cards.push({ id: `c${n++}`, color, value });
  for (const color of COLORS) {
    add(color, '0');
    for (const value of [...NUMBER_VALUES.slice(1), 'skip', 'reverse', 'draw2'] as Value[]) {
      add(color, value);
      add(color, value);
    }
  }
  for (let i = 0; i < 4; i++) {
    add(null, 'wild');
    add(null, 'wild4');
  }
  return cards;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// mulberry32: small deterministic PRNG for tests
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
