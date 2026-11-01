import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { parseCode, readGame, readRoom, writeGame } from '@/server/rooms';
import { applyAction } from '@/game/engine';
import { botAction } from '@/game/bot';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  if (!Number.isSafeInteger(body.seq)) throw new HttpError(400, 'Missing game sequence');
  await adminDb().runTransaction(async (tx) => {
    const now = Date.now();
    const room = await readRoom(tx, code, now);
    if (!room.game?.players.some((p) => p.id === uid && !p.isBot)) throw new HttpError(403, 'You are not in this game');
    if (room.game.status !== 'playing' || room.game.lastAction.seq !== body.seq) return;
    const bot = room.game.players.find((p) => p.id === room.game!.turnPlayerId && p.isBot);
    if (!bot) return;
    const state = await readGame(tx, code, room);
    const result = applyAction(state, bot.id, botAction(state, bot.id), now, Math.random);
    if (!result.ok) throw new HttpError(409, result.error);
    writeGame(tx, code, room, result.state, now, state);
  });
});
