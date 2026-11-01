import { describe, expect, it } from 'vitest';
import { botAction } from '../bot';
import { applyAction, startGame } from '../engine';
import { seededRng } from '../deck';
import { c, makeState } from './helpers';

describe('bot turns', () => {
  it('calls Juan before playing down to one card', () => {
    const state = makeState({ hands: { bot: [c('a', 'red', '3'), c('b', 'blue', '4')], human: [c('c', 'green', '5')] }, top: c('top', 'red', '1') });
    expect(botAction(state, 'bot')).toEqual({ type: 'callJuan' });
  });

  it('stacks a matching penalty and chooses its strongest colour for a wild', () => {
    const state = makeState({ hands: { bot: [c('w', null, 'wild4'), c('b', 'blue', '1'), c('b2', 'blue', '2')], human: [c('c', 'green', '5')] }, top: c('top', null, 'wild4'), color: 'red', pendingDraw: { kind: 'wild4', count: 4 } });
    expect(botAction(state, 'bot')).toEqual({ type: 'play', cardId: 'w', chosenColor: 'blue' });
  });

  it('plays complete games using only accepted moves', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed);
      let state = startGame([{ id: 'one', name: 'One', isBot: true }, { id: 'two', name: 'Two', isBot: true }, { id: 'three', name: 'Three', isBot: true }], rng, 0);
      for (let turn = 0; turn < 2000 && state.pub.status === 'playing'; turn++) {
        const id = state.pub.turnPlayerId;
        const result = applyAction(state, id, botAction(state, id), turn, rng);
        expect(result.ok, result.ok ? '' : result.error).toBe(true);
        if (!result.ok) break;
        state = result.state;
      }
      expect(state.pub.status).toBe('finished');
    }
  });
});
