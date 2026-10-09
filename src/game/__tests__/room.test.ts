import { describe, expect, it } from 'vitest';
import { activeLobby, canStartGame, nextHostId, type RoomDoc } from '../room';
import { c, filler, makeState } from './helpers';
import type { Player } from '../types';

const P = (id: string): Player => ({ id, name: id.toUpperCase() });

function room(o: { lobby: string[]; host: string; missed?: Record<string, number>; status?: 'playing' | 'finished' | null }): RoomDoc {
  const ids = ['a', 'b', 'c'];
  const game = o.status === null ? null : makeState({
    hands: Object.fromEntries(ids.map((id) => [id, filler(id)])), top: c('t', 'red', '5'), missedTurns: o.missed,
  }).pub;
  if (game) game.status = o.status ?? 'finished';
  return { code: 'ABCDE', hostId: o.host, lobby: o.lobby.map(P), game, createdAt: 0, updatedAt: 0 };
}

describe('activeLobby', () => {
  it('keeps everyone when there is no finished game', () => {
    expect(activeLobby(room({ lobby: ['a', 'b'], host: 'a', status: null })).map((p) => p.id)).toEqual(['a', 'b']);
    expect(activeLobby(room({ lobby: ['a', 'b'], host: 'a', missed: { b: 5 }, status: 'playing' })).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('drops players who missed 2+ turns in a row in the finished game', () => {
    const r = room({ lobby: ['a', 'b', 'c', 'd'], host: 'a', missed: { b: 2, c: 1 } });
    expect(activeLobby(r).map((p) => p.id)).toEqual(['a', 'c', 'd']);
  });

  it('never drops the player starting the game', () => {
    const r = room({ lobby: ['a', 'b', 'c'], host: 'a', missed: { a: 3 } });
    expect(activeLobby(r, 'a').map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(activeLobby(r).map((p) => p.id)).toEqual(['b', 'c']);
  });
});

describe('nextHostId / canStartGame', () => {
  it('passes the host to the first remaining member if the host walked away', () => {
    const r = room({ lobby: ['a', 'b', 'c'], host: 'a', missed: { a: 2 } });
    expect(nextHostId(r, activeLobby(r))).toBe('b');
    expect(canStartGame(r, 'b')).toBe(true);
    expect(canStartGame(r, 'c')).toBe(false);
    expect(canStartGame(r, 'a')).toBe(true); // came back
  });

  it('only the host may start normally', () => {
    const r = room({ lobby: ['a', 'b'], host: 'a' });
    expect(canStartGame(r, 'a')).toBe(true);
    expect(canStartGame(r, 'b')).toBe(false);
    expect(canStartGame(r, 'z')).toBe(false);
  });

  it('any lobby member may start when the host is no longer in the lobby', () => {
    const r = room({ lobby: ['b', 'c'], host: 'a' });
    expect(canStartGame(r, 'c')).toBe(true);
    expect(nextHostId(r, activeLobby(r))).toBe('b');
  });
});
