import { applyAction } from '../engine';
import { seededRng } from '../deck';
import type { Action, Card, Color, GameState, PendingDraw, Rng, Value } from '../types';

export const c = (id: string, color: Color | null, value: Value): Card => ({ id, color, value });

/** Three harmless cards (never identical to the usual red/blue test tops). */
export const filler = (p: string): Card[] => [c(`${p}1`, 'green', '7'), c(`${p}2`, 'green', '8'), c(`${p}3`, 'yellow', '3')];

export interface MakeStateOpts {
  hands: Record<string, Card[]>;
  top: Card;
  color?: Color;
  turn?: string;
  direction?: 1 | -1;
  pendingDraw?: PendingDraw | null;
  drawPile?: Card[];
  discard?: Card[];
  catchable?: string | null;
  drawnCardId?: string | null;
  calledJuan?: string[];
  deadline?: number;
}

export function makeState(o: MakeStateOpts): GameState {
  const ids = Object.keys(o.hands);
  const hands = structuredClone(o.hands);
  const drawPile = o.drawPile ?? Array.from({ length: 20 }, (_, i) => c(`p${i}`, 'yellow', '6'));
  return {
    pub: {
      status: 'playing',
      players: ids.map((id) => ({
        id,
        name: id.toUpperCase(),
        cardCount: hands[id].length,
        calledJuan: o.calledJuan?.includes(id) ?? false,
      })),
      turnPlayerId: o.turn ?? ids[0],
      direction: o.direction ?? 1,
      topCard: o.top,
      currentColor: o.color ?? (o.top.color as Color),
      pendingDraw: o.pendingDraw ?? null,
      turnDeadline: o.deadline ?? 30_000,
      drawnCardId: o.drawnCardId ?? null,
      catchable: o.catchable ?? null,
      drawPileCount: drawPile.length,
      lastAction: { seq: 0, type: 'start', playerId: ids[0] },
      winnerId: null,
    },
    priv: { hands, drawPile, discard: o.discard ?? [] },
  };
}

export function act(s: GameState, pid: string, action: Action, now = 0, rng: Rng = seededRng(1)): GameState {
  const r = applyAction(s, pid, action, now, rng);
  if (!r.ok) throw new Error(`unexpected error: ${r.error}`);
  return r.state;
}

export function actErr(s: GameState, pid: string, action: Action, now = 0, rng: Rng = seededRng(1)): string {
  const r = applyAction(s, pid, action, now, rng);
  if (r.ok) throw new Error('expected an error');
  return r.error;
}
