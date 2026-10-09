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
