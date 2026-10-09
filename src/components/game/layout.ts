export interface Pos { x: number; y: number } // percent of viewport

export const PILE_POS: Pos = { x: 50, y: 44 };
export const ME_POS: Pos = { x: 50, y: 90 };

/**
 * Opponents spread on an arc from left, over the top, to right.
 * `compact` (narrow screens) uses a taller arc (y ≈ 10–38%, x ≈ 8–92%) so up to 7 seats don't collide.
 */
export function seatPositions(count: number, compact = false): Pos[] {
  const [rx, cy, ry] = compact ? [42, 38, 28] : [41, 34, 23];
  return Array.from({ length: count }, (_, i) => {
    const t = Math.PI + (Math.PI * (i + 1)) / (count + 1);
    return { x: 50 + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

/** Motion offset (in viewport units) from `to` back to `from`. */
export const offsetFrom = (from: Pos, to: Pos) => ({ x: `${from.x - to.x}vw`, y: `${from.y - to.y}vh` });
