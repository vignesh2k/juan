import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { parseCode, readRoom, roomRef } from '@/server/rooms';
import { isRoomOpen } from '@/game/room';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const playerId = body.playerId;
  if (typeof playerId !== 'string' || !playerId) throw new HttpError(400, 'Missing player');
  if (playerId === uid) throw new HttpError(400, "You can't remove yourself — use Leave");
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    if (room.hostId !== uid) throw new HttpError(403, 'Only the host can remove players');
    if (!isRoomOpen(room)) throw new HttpError(409, "Can't remove players mid-game");
    const lobby = room.lobby.filter((p) => p.id !== playerId);
    if (lobby.length === room.lobby.length) return;
    tx.update(roomRef(code), { lobby, updatedAt: now });
  });
});
