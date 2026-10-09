export interface Pos { x: number; y: number } // percent of viewport

export const PILE_POS: Pos = { x: 50, y: 44 };
export const ME_POS: Pos = { x: 50, y: 90 };

/** Opponents spread on an arc from left, over the top, to right. */
export function seatPositions(count: number): Pos[] {
  return Array.from({ length: count }, (_, i) => {
    const t = Math.PI + (Math.PI * (i + 1)) / (count + 1);
    return { x: 50 + 41 * Math.cos(t), y: 34 + 23 * Math.sin(t) };
  });
}

/** Motion offset (in viewport units) from `to` back to `from`. */
export const offsetFrom = (from: Pos, to: Pos) => ({ x: `${from.x - to.x}vw`, y: `${from.y - to.y}vh` });
