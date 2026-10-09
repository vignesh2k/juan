import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { parseCode, readRoom, writeGame } from '@/server/rooms';
import { startGame } from '@/game/engine';
import { activeLobby, canStartGame, isRoomOpen, nextHostId } from '@/game/room';
import { MIN_PLAYERS } from '@/game/types';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    if (!isRoomOpen(room)) throw new HttpError(409, 'The game is already running');
    if (!canStartGame(room, uid)) throw new HttpError(403, 'Only the host can start the game');
    // Players who timed out repeatedly at the end of the last game walked away: don't deal them in.
    const lobby = activeLobby(room, uid);
    if (lobby.length < MIN_PLAYERS) {
      const dropped = room.lobby.length - lobby.length;
      throw new HttpError(409, dropped
        ? `Need at least ${MIN_PLAYERS} active players — ${dropped} timed out and were left out`
        : `Need at least ${MIN_PLAYERS} players`);
    }
    const next = { ...room, lobby, hostId: nextHostId(room, lobby) };
    writeGame(tx, code, next, startGame(lobby, Math.random, now, room.game?.lastAction.seq ?? 0), now);
  });
});
