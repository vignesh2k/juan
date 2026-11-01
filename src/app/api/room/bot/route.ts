import { randomUUID } from 'node:crypto';
import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { parseCode, readRoom, roomRef } from '@/server/rooms';
import { isRoomOpen } from '@/game/room';
import { MAX_PLAYERS } from '@/game/types';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  await adminDb().runTransaction(async (tx) => {
    const now = Date.now();
    const room = await readRoom(tx, code, now);
    if (room.hostId !== uid) throw new HttpError(403, 'Only the host can add bots');
    if (!isRoomOpen(room)) throw new HttpError(409, "Can't add bots mid-game");
    if (room.lobby.length >= MAX_PLAYERS) throw new HttpError(409, 'That room is full');
    const names = new Set(room.lobby.map((p) => p.name));
    let number = 1;
    while (names.has(`Bot ${number}`)) number++;
    tx.update(roomRef(code), { lobby: [...room.lobby, { id: `bot-${randomUUID()}`, name: `Bot ${number}`, isBot: true }], updatedAt: now });
  });
});
