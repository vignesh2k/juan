import { adminDb } from '@/server/firebaseAdmin';
import { handler } from '@/server/http';
import { parseCode, readRoom, roomRef } from '@/server/rooms';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    // Mid-game this only takes the player out of the lobby, so they aren't dealt into the next
    // game; their seat in the current game stays and the turn timer covers their turns.
    const lobby = room.lobby.filter((p) => p.id !== uid);
    if (lobby.length === room.lobby.length) return;
    const hostId = room.hostId === uid ? (lobby[0]?.id ?? room.hostId) : room.hostId;
    tx.update(roomRef(code), { lobby, hostId, updatedAt: now });
  });
});
