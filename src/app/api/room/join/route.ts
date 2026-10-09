import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { cleanName, parseCode, readRoom, roomRef } from '@/server/rooms';
import { isRoomOpen } from '@/game/room';
import { MAX_PLAYERS } from '@/game/types';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const name = cleanName(body.name);
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    if (room.game?.players.some((p) => p.id === uid) && !isRoomOpen(room)) return; // rejoin mid-game
    const inLobby = room.lobby.some((p) => p.id === uid);
    if (!inLobby && !isRoomOpen(room)) throw new HttpError(409, 'That game has already started');
    if (!inLobby && room.lobby.length >= MAX_PLAYERS) throw new HttpError(409, 'That room is full');
    const lobby = inLobby ? room.lobby.map((p) => (p.id === uid ? { ...p, name } : p)) : [...room.lobby, { id: uid, name }];
    tx.update(roomRef(code), { lobby, updatedAt: now });
  });
  return { code };
});
