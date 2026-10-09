import { describe, expect, it } from 'vitest';
import { createDeck, seededRng, shuffle } from '../deck';

describe('createDeck', () => {
  it('builds a standard 108-card deck with unique ids', () => {
    const d = createDeck();
    expect(d).toHaveLength(108);
    expect(new Set(d.map((c) => c.id)).size).toBe(108);
    expect(d.filter((c) => c.value === 'wild4')).toHaveLength(4);
    expect(d.filter((c) => c.value === 'wild')).toHaveLength(4);
    expect(d.filter((c) => c.color === 'red' && c.value === '0')).toHaveLength(1);
    expect(d.filter((c) => c.color === 'red' && c.value === '7')).toHaveLength(2);
    expect(d.filter((c) => c.color === 'blue' && c.value === 'draw2')).toHaveLength(2);
  });
});

describe('shuffle', () => {
  it('is deterministic for a seed and keeps all items', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], seededRng(7));
    const b = shuffle([1, 2, 3, 4, 5, 6], seededRng(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
