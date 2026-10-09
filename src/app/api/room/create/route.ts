import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { cleanName, roomRef } from '@/server/rooms';
import { isRoomExpired, type RoomDoc } from '@/game/room';
import { generateRoomCode } from '@/game/roomCode';

export const POST = handler(async (uid, body) => {
  const name = cleanName(body.name);
  const now = Date.now();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const created = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(roomRef(code));
      const existing = snap.data() as RoomDoc | undefined;
      if (existing && !isRoomExpired(existing, now)) return false;
      const room: RoomDoc = { code, hostId: uid, lobby: [{ id: uid, name }], game: null, createdAt: now, updatedAt: now };
      tx.set(roomRef(code), room);
      return true;
    });
    if (created) return { code };
  }
  throw new HttpError(503, 'Could not create a room — try again');
});
