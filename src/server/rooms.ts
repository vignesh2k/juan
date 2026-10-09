import type { Transaction } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { HttpError } from './http';
import { isRoomExpired, type RoomDoc } from '@/game/room';
import { isValidRoomCode, normalizeRoomCode } from '@/game/roomCode';
import type { Card, GameState } from '@/game/types';

export const roomRef = (code: string) => adminDb().collection('rooms').doc(code);
const handRef = (code: string, uid: string) => roomRef(code).collection('hands').doc(uid);
const secretRef = (code: string) => roomRef(code).collection('secret').doc('deck');

export function parseCode(raw: unknown): string {
  const code = normalizeRoomCode(String(raw ?? ''));
  if (!isValidRoomCode(code)) throw new HttpError(400, 'Room codes are 5 letters/numbers');
  return code;
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) throw new HttpError(400, 'Enter a nickname');
  return name;
}

export async function readRoom(tx: Transaction, code: string, now: number): Promise<RoomDoc> {
  const snap = await tx.get(roomRef(code));
  const room = snap.data() as RoomDoc | undefined;
  if (!room || isRoomExpired(room, now)) throw new HttpError(404, 'Room not found');
  return room;
}

/** Reads the full game state. Must be called before any writes in the transaction. */
export async function readGame(tx: Transaction, code: string, room: RoomDoc): Promise<GameState> {
  if (!room.game) throw new HttpError(409, 'The game has not started');
  const ids = room.game.players.map((p) => p.id);
  const [secretSnap, ...handSnaps] = await tx.getAll(secretRef(code), ...ids.map((id) => handRef(code, id)));
  const secret = secretSnap.data() as { drawPile: Card[]; discard: Card[] };
  const hands = Object.fromEntries(ids.map((id, i) => [id, (handSnaps[i].data()?.cards ?? []) as Card[]]));
  return { pub: room.game, priv: { hands, drawPile: secret.drawPile, discard: secret.discard } };
}

export function writeGame(tx: Transaction, code: string, room: RoomDoc, state: GameState, now: number) {
  tx.set(roomRef(code), { ...room, game: state.pub, updatedAt: now } satisfies RoomDoc);
  for (const [id, cards] of Object.entries(state.priv.hands)) tx.set(handRef(code, id), { cards });
  tx.set(secretRef(code), { drawPile: state.priv.drawPile, discard: state.priv.discard });
}
