import type { Card } from '@/game/types';

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3 } as const;
const VALUE_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'];

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      (a.color ? COLOR_ORDER[a.color] : 4) - (b.color ? COLOR_ORDER[b.color] : 4) ||
      VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) ||
      a.id.localeCompare(b.id),
  );
}
