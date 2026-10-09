import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { parseCode, readRoom, writeGame } from '@/server/rooms';
import { startGame } from '@/game/engine';
import { isRoomOpen } from '@/game/room';
import { MIN_PLAYERS } from '@/game/types';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    if (room.hostId !== uid) throw new HttpError(403, 'Only the host can start the game');
    if (!isRoomOpen(room)) throw new HttpError(409, 'The game is already running');
    if (room.lobby.length < MIN_PLAYERS) throw new HttpError(409, `Need at least ${MIN_PLAYERS} players`);
    writeGame(tx, code, room, startGame(room.lobby, Math.random, now, room.game?.lastAction.seq ?? 0), now);
  });
});
