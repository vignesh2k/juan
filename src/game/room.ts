import type { Player, PublicState } from './types';

export interface RoomDoc {
  code: string;
  hostId: string;
  lobby: Player[];
  game: PublicState | null;
  createdAt: number;
  updatedAt: number;
}

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export const isRoomExpired = (room: RoomDoc, now: number) => now - room.updatedAt > ROOM_TTL_MS;

/** Room is accepting players: no game yet, or the last game finished. */
export const isRoomOpen = (room: RoomDoc) => !room.game || room.game.status === 'finished';

/** Consecutive timed-out turns after which a player is treated as having walked away. */
export const AFK_MISSED_TURNS = 2;

/**
 * Lobby members who'll be dealt into the next game: drops anyone who timed out
 * AFK_MISSED_TURNS+ turns in a row at the end of the finished game. `keepId` (whoever
 * is starting) is never dropped — they're clearly here.
 */
export function activeLobby(room: RoomDoc, keepId?: string): Player[] {
  const game = room.game;
  if (!game || game.status !== 'finished') return room.lobby;
  const afk = new Set(game.players.filter((p) => (p.missedTurns ?? 0) >= AFK_MISSED_TURNS).map((p) => p.id));
  return room.lobby.filter((p) => p.id === keepId || !afk.has(p.id));
}

/** Host for the next game: the host if still active, else the first active lobby member. */
export function nextHostId(room: RoomDoc, lobby: Player[]): string {
  return lobby.some((p) => p.id === room.hostId) ? room.hostId : (lobby[0]?.id ?? room.hostId);
}

/**
 * Who may start the next game: the host, or — when the host has left the lobby or walked
 * away from the last game — any lobby member who'd take over (any member if the host left).
 */
export function canStartGame(room: RoomDoc, uid: string): boolean {
  if (!room.lobby.some((p) => p.id === uid)) return false;
  if (uid === room.hostId) return true;
  if (!room.lobby.some((p) => p.id === room.hostId)) return true;
  return nextHostId(room, activeLobby(room)) === uid;
}
