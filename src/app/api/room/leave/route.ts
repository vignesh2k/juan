import { adminDb } from '@/server/firebaseAdmin';
import { handler } from '@/server/http';
import { parseCode, readRoom, roomRef } from '@/server/rooms';
import { isRoomOpen } from '@/game/room';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    if (!isRoomOpen(room)) return; // can't leave mid-game; the turn timer covers absent players
    const lobby = room.lobby.filter((p) => p.id !== uid);
    const hostId = room.hostId === uid ? (lobby[0]?.id ?? room.hostId) : room.hostId;
    tx.update(roomRef(code), { lobby, hostId, updatedAt: now });
  });
});
