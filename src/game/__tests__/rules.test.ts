import { describe, expect, it } from 'vitest';
import { canPlay, explainIllegal, isIdentical, legalCardIds } from '../rules';
import { c, makeState } from './helpers';

describe('rules', () => {
  const base = () =>
    makeState({
      hands: { a: [c('r3', 'red', '3'), c('b5', 'blue', '5'), c('g7', 'green', '7'), c('w4', null, 'wild4')], b: [c('r5', 'red', '5')] },
      top: c('t', 'red', '5'),
    });

  it('allows colour match, value match, and wild4 on your turn', () => {
    const s = base();
    expect([...legalCardIds(s.pub, 'a', s.priv.hands.a)].sort()).toEqual(['b5', 'r3', 'w4']);
  });

  it('lets others play only identical cards (jump-in)', () => {
    const s = base();
    expect(canPlay(s.pub, 'b', c('r5', 'red', '5'))).toBe(true);
    expect(canPlay(s.pub, 'b', c('x', 'blue', '5'))).toBe(false);
  });

  it('only same draw kind is playable on a pending stack', () => {
    const s = makeState({ hands: { a: [], b: [] }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    expect(canPlay(s.pub, 'a', c('g2', 'green', 'draw2'))).toBe(true);
    expect(canPlay(s.pub, 'a', c('w4', null, 'wild4'))).toBe(false);
    expect(canPlay(s.pub, 'a', c('r9', 'red', '9'))).toBe(false);
  });

  it('after drawing only the drawn card is playable', () => {
    const s = makeState({ hands: { a: [c('r3', 'red', '3'), c('r9', 'red', '9')], b: [] }, top: c('t', 'red', '5'), drawnCardId: 'r9' });
    expect([...legalCardIds(s.pub, 'a', s.priv.hands.a)]).toEqual(['r9']);
  });

  it('wild cards are identical to the same wild type', () => {
    expect(isIdentical(c('x', null, 'wild4'), c('y', null, 'wild4'))).toBe(true);
    expect(isIdentical(c('x', null, 'wild'), c('y', null, 'wild4'))).toBe(false);
  });

  it('explains why a card is illegal', () => {
    const s = base();
    expect(explainIllegal(s.pub, 'b', c('x', 'blue', '9'))).toMatch(/exact same card/);
    expect(explainIllegal(s.pub, 'a', c('g7', 'green', '7'))).toMatch(/doesn't match/);
  });
});
