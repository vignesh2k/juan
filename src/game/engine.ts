import type { Action, ActionResult, GameState, Rng } from './types';

export function applyAction(_s: GameState, _p: string, _a: Action, _now: number, _rng: Rng): ActionResult {
  return { ok: false, error: 'not implemented' };
}
