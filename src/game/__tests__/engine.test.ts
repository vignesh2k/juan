import { describe, expect, it } from 'vitest';
import { startGame } from '../engine';
import { seededRng } from '../deck';
import { act, actErr, c, filler, makeState } from './helpers';

const R5 = c('t', 'red', '5');

describe('startGame', () => {
  it('deals 7 each and flips a number card', () => {
    const s = startGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seededRng(42), 1000);
    expect(s.priv.hands.a).toHaveLength(7);
    expect(s.priv.hands.b).toHaveLength(7);
    expect(s.pub.topCard.value).toMatch(/^[0-9]$/);
    expect(s.pub.currentColor).toBe(s.pub.topCard.color);
    expect(s.pub.players.map((p) => p.cardCount)).toEqual([7, 7]);
    expect(s.pub.drawPileCount).toBe(108 - 14 - 1);
    expect(s.pub.turnDeadline).toBe(31_000);
    expect(['a', 'b']).toContain(s.pub.turnPlayerId);
  });
});

describe('basic play', () => {
  const s = () => makeState({ hands: { a: [c('r3', 'red', '3'), c('b5', 'blue', '5'), ...filler('a')], b: filler('b'), c: filler('c') }, top: R5 });

  it('plays a colour match and passes the turn', () => {
    const n = act(s(), 'a', { type: 'play', cardId: 'r3' }, 100);
    expect(n.pub.topCard.id).toBe('r3');
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.players[0].cardCount).toBe(4);
    expect(n.priv.discard.map((x) => x.id)).toEqual(['t']);
    expect(n.pub.turnDeadline).toBe(30_100);
    expect(n.pub.lastAction).toMatchObject({ seq: 1, type: 'play', playerId: 'a' });
  });

  it('plays a value match and changes colour', () => {
    const n = act(s(), 'a', { type: 'play', cardId: 'b5' });
    expect(n.pub.currentColor).toBe('blue');
  });

  it('rejects a non-matching card', () => {
    expect(actErr(s(), 'a', { type: 'play', cardId: 'a1' })).toMatch(/can't play/);
  });

  it('rejects a card you do not hold', () => {
    expect(actErr(s(), 'a', { type: 'play', cardId: 'zzz' })).toMatch(/don't have/);
  });
});

describe('+4 and stacking', () => {
  it('+4 can be played on anything and needs a colour', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4'), ...filler('a')], b: filler('b') }, top: R5 });
    expect(actErr(s, 'a', { type: 'play', cardId: 'w4' })).toMatch(/Pick a colour/);
    const n = act(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'blue' });
    expect(n.pub.currentColor).toBe('blue');
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 4 });
    expect(n.pub.turnPlayerId).toBe('b');
  });

  it('+4 cannot go on a pending +2', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4'), ...filler('a')], b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    expect(actErr(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'red' })).toMatch(/Stack a \+2/);
  });

  it('+2 of any colour stacks on +2', () => {
    const s = makeState({ hands: { a: [c('g2', 'green', 'draw2'), ...filler('a')], b: filler('b'), c: filler('c') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    const n = act(s, 'a', { type: 'play', cardId: 'g2' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'draw2', count: 4 });
    expect(n.pub.turnPlayerId).toBe('b');
  });

  it('+2 cannot go on a pending +4', () => {
    const s = makeState({ hands: { a: [c('r2', 'red', 'draw2'), ...filler('a')], b: filler('b') }, top: c('t', null, 'wild4'), color: 'red', pendingDraw: { kind: 'wild4', count: 4 } });
    expect(actErr(s, 'a', { type: 'play', cardId: 'r2' })).toMatch(/Stack a \+4/);
  });

  it('+4 stacks on +4', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4'), ...filler('a')], b: filler('b') }, top: c('t', null, 'wild4'), color: 'red', pendingDraw: { kind: 'wild4', count: 4 } });
    const n = act(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'green' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 8 });
  });

  it('a normal card cannot be played on a pending stack', () => {
    const s = makeState({ hands: { a: [c('r9', 'red', '9'), ...filler('a')], b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    expect(actErr(s, 'a', { type: 'play', cardId: 'r9' })).toMatch(/Stack/);
  });

  it('drawing on a pending stack takes the whole stack and ends the turn', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 4 } });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.priv.hands.a).toHaveLength(7);
    expect(n.pub.pendingDraw).toBeNull();
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.lastAction).toMatchObject({ type: 'stackDraw', playerId: 'a', n: 4 });
  });
});

describe('jump-in', () => {
  const four = (extra: Partial<Parameters<typeof makeState>[0]> = {}) =>
    makeState({ hands: { a: filler('a'), b: filler('b'), c: [c('r5b', 'red', '5'), c('r5c', 'blue', '5'), ...filler('c')], d: [c('r2d', 'red', 'draw2'), ...filler('d')] }, top: R5, ...extra });

  it('an identical card jumps in and skips everyone between', () => {
    const n = act(four(), 'c', { type: 'play', cardId: 'r5b' });
    expect(n.pub.topCard.id).toBe('r5b');
    expect(n.pub.turnPlayerId).toBe('d');
    expect(n.pub.lastAction.type).toBe('jump');
  });

  it('a same-number different-colour card cannot jump in', () => {
    expect(actErr(four(), 'c', { type: 'play', cardId: 'r5c' })).toMatch(/exact same card/);
  });

  it('jumping onto a +2 stack adds to it and passes it on from the jumper', () => {
    const s = four({ top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 }, turn: 'b' });
    const n = act(s, 'd', { type: 'play', cardId: 'r2d' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'draw2', count: 4 });
    expect(n.pub.turnPlayerId).toBe('a');
  });

  it('jumping a +4 onto a +4 stack adds 4', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b'), c: [c('w4', null, 'wild4'), ...filler('c')], d: filler('d') }, top: c('t', null, 'wild4'), color: 'green', pendingDraw: { kind: 'wild4', count: 4 }, turn: 'b' });
    const n = act(s, 'c', { type: 'play', cardId: 'w4', chosenColor: 'red' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 8 });
    expect(n.pub.turnPlayerId).toBe('d');
    expect(n.pub.currentColor).toBe('red');
  });

  it('a wild can jump in on a wild', () => {
    const s = makeState({ hands: { a: filler('a'), b: [c('w', null, 'wild'), ...filler('b')] }, top: c('t', null, 'wild'), color: 'blue' });
    const n = act(s, 'b', { type: 'play', cardId: 'w', chosenColor: 'yellow' });
    expect(n.pub.currentColor).toBe('yellow');
    expect(n.pub.turnPlayerId).toBe('a');
  });
});

describe('action cards', () => {
  it('skip skips the next player', () => {
    const s = makeState({ hands: { a: [c('rs', 'red', 'skip'), ...filler('a')], b: filler('b'), c: filler('c') }, top: R5 });
    expect(act(s, 'a', { type: 'play', cardId: 'rs' }).pub.turnPlayerId).toBe('c');
  });

  it('reverse flips direction with 3 players', () => {
    const s = makeState({ hands: { a: [c('rr', 'red', 'reverse'), ...filler('a')], b: filler('b'), c: filler('c') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'rr' });
    expect(n.pub.direction).toBe(-1);
    expect(n.pub.turnPlayerId).toBe('c');
  });

  it('reverse acts as skip with 2 players', () => {
    const s = makeState({ hands: { a: [c('rr', 'red', 'reverse'), ...filler('a')], b: filler('b') }, top: R5 });
    expect(act(s, 'a', { type: 'play', cardId: 'rr' }).pub.turnPlayerId).toBe('a');
  });

  it('skip with 2 players gives you another turn', () => {
    const s = makeState({ hands: { a: [c('rs', 'red', 'skip'), ...filler('a')], b: filler('b') }, top: R5 });
    expect(act(s, 'a', { type: 'play', cardId: 'rs' }).pub.turnPlayerId).toBe('a');
  });
});

describe('drawing', () => {
  it('a playable drawn card may be played immediately (only that card)', () => {
    const s = makeState({ hands: { a: [c('r3', 'red', '3'), ...filler('a')], b: filler('b') }, top: R5, drawPile: [c('d1', 'red', '9')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.pub.drawnCardId).toBe('d1');
    expect(n.pub.turnPlayerId).toBe('a');
    expect(actErr(n, 'a', { type: 'play', cardId: 'r3' })).toMatch(/just drew/);
    expect(act(n, 'a', { type: 'play', cardId: 'd1' }).pub.turnPlayerId).toBe('b');
  });

  it('can pass after drawing a playable card', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [c('d1', 'red', '9')] });
    const n = act(act(s, 'a', { type: 'draw' }), 'a', { type: 'pass' });
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.drawnCardId).toBeNull();
  });

  it('cannot pass without drawing', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5 });
    expect(actErr(s, 'a', { type: 'pass' })).toMatch(/Draw a card first/);
  });

  it('an unplayable drawn card ends the turn', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [c('d1', 'blue', '9')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.priv.hands.a).toHaveLength(4);
    expect(n.pub.turnPlayerId).toBe('b');
  });

  it('cannot draw twice', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [c('d1', 'red', '9')] });
    expect(actErr(act(s, 'a', { type: 'draw' }), 'a', { type: 'draw' })).toMatch(/already drew/);
  });

  it('cannot draw out of turn', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5 });
    expect(actErr(s, 'b', { type: 'draw' })).toMatch(/not your turn/);
  });

  it('reshuffles the discard pile when the draw pile is empty', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [], discard: [c('x1', 'blue', '1'), c('x2', 'blue', '2')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.priv.hands.a).toHaveLength(4);
    expect(n.priv.drawPile.length + n.priv.discard.length).toBe(1);
    expect(n.priv.discard).toHaveLength(0);
  });
});

describe('Juan call', () => {
  const two = () => makeState({ hands: { a: [c('r3', 'red', '3'), c('g7', 'green', '7')], b: [c('r9', 'red', '9'), ...filler('b')], c: filler('c') }, top: R5 });

  it('going to 1 card without calling makes you catchable; catch gives +2', () => {
    const n = act(two(), 'a', { type: 'play', cardId: 'r3' });
    expect(n.pub.catchable).toBe('a');
    const m = act(n, 'c', { type: 'catch', targetId: 'a' });
    expect(m.priv.hands.a).toHaveLength(3);
    expect(m.pub.catchable).toBeNull();
    expect(m.pub.lastAction).toMatchObject({ type: 'catch', playerId: 'c', targetId: 'a', n: 2 });
  });

  it('calling Juan at 2 cards prevents being catchable', () => {
    const n = act(act(two(), 'a', { type: 'callJuan' }), 'a', { type: 'play', cardId: 'r3' });
    expect(n.pub.catchable).toBeNull();
  });

  it('cannot call Juan with 3+ cards', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5 });
    expect(actErr(s, 'a', { type: 'callJuan' })).toMatch(/2 cards/);
  });

  it('calling Juan at 1 card while catchable saves you', () => {
    const n = act(act(two(), 'a', { type: 'play', cardId: 'r3' }), 'a', { type: 'callJuan' });
    expect(n.pub.catchable).toBeNull();
    expect(actErr(n, 'c', { type: 'catch', targetId: 'a' })).toMatch(/Too late/);
  });

  it('the catch window closes after the next play', () => {
    const n = act(act(two(), 'a', { type: 'play', cardId: 'r3' }), 'b', { type: 'play', cardId: 'r9' });
    expect(n.pub.catchable).toBeNull();
  });

  it('cannot catch yourself', () => {
    const n = act(two(), 'a', { type: 'play', cardId: 'r3' });
    expect(actErr(n, 'a', { type: 'catch', targetId: 'a' })).toMatch(/yourself/);
  });

  it('drawing resets your Juan call', () => {
    const s = makeState({ hands: { a: [c('g7', 'green', '7'), c('g8', 'green', '8')], b: filler('b') }, top: R5, calledJuan: ['a'], drawPile: [c('d1', 'blue', '9')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.pub.players[0].calledJuan).toBe(false);
  });
});

describe('ending the game', () => {
  it('playing your last number card wins', () => {
    const s = makeState({ hands: { a: [c('r3', 'red', '3')], b: filler('b') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'r3' });
    expect(n.pub.status).toBe('finished');
    expect(n.pub.winnerId).toBe('a');
    expect(actErr(n, 'b', { type: 'draw' })).toMatch(/over/);
  });

  it('ending on a power card draws a 1-card penalty', () => {
    const s = makeState({ hands: { a: [c('rs', 'red', 'skip')], b: filler('b'), c: filler('c') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'rs' });
    expect(n.pub.status).toBe('playing');
    expect(n.priv.hands.a).toHaveLength(1);
    expect(n.pub.turnPlayerId).toBe('c');
    expect(n.pub.lastAction).toMatchObject({ type: 'play', penalty: true });
    expect(n.pub.catchable).toBeNull();
  });

  it('ending on a +4 still applies the +4 and the penalty', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4')], b: filler('b') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'red' });
    expect(n.priv.hands.a).toHaveLength(1);
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 4 });
  });
});

describe('turn timer', () => {
  it('rejects timeout before the deadline', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, deadline: 30_000 });
    expect(actErr(s, 'b', { type: 'timeout' }, 29_000)).toMatch(/not timed out/);
  });

  it('auto-draws 1 and passes the turn after the deadline', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, deadline: 30_000, drawPile: [c('d1', 'red', '9')] });
    const n = act(s, 'b', { type: 'timeout' }, 30_001);
    expect(n.priv.hands.a).toHaveLength(4);
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.lastAction).toMatchObject({ type: 'timeout', playerId: 'a', n: 1 });
  });

  it('auto-draws the pending stack on timeout', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 4 }, deadline: 30_000 });
    const n = act(s, 'b', { type: 'timeout' }, 30_001);
    expect(n.priv.hands.a).toHaveLength(7);
    expect(n.pub.pendingDraw).toBeNull();
  });
});
