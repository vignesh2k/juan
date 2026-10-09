import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { parseCode, readGame, readRoom, writeGame } from '@/server/rooms';
import { applyAction } from '@/game/engine';
import type { Action } from '@/game/types';

const ACTION_TYPES = new Set(['play', 'draw', 'pass', 'callJuan', 'catch', 'timeout']);

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const action = body.action as Action;
  if (!action || !ACTION_TYPES.has(action.type)) throw new HttpError(400, 'Unknown action');
  if (action.type === 'play' && typeof action.cardId !== 'string') throw new HttpError(400, 'Missing card');
  if (action.type === 'catch' && typeof action.targetId !== 'string') throw new HttpError(400, 'Missing player to catch');
  await adminDb().runTransaction(async (tx) => {
    const now = Date.now();
    const room = await readRoom(tx, code, now);
    const state = await readGame(tx, code, room);
    const result = applyAction(state, uid, action, now, Math.random);
    if (!result.ok) throw new HttpError(400, result.error);
    writeGame(tx, code, room, result.state, now);
  });
});
