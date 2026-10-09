import { createDeck, shuffle } from './deck';
import { canPlay, explainIllegal, isNumber, isPower, isWild, matchesTop } from './rules';
import {
  COLORS, HAND_SIZE, MAX_PLAYERS, MIN_PLAYERS, TURN_MS,
  type Action, type ActionResult, type Card, type Color, type GameState, type LastAction, type Player, type PlayerPublic, type Rng,
} from './types';

export function startGame(players: Player[], rng: Rng, now: number, prevSeq = 0): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Need ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error('Duplicate player ids');
  // Re-id after shuffling so a card's id never reveals what it is (ids reach clients via drawnCardId etc.).
  const drawPile = withOpaqueIds(shuffle(createDeck(), rng), rng);
  const hands: Record<string, Card[]> = {};
  for (const p of players) hands[p.id] = drawPile.splice(0, HAND_SIZE);
  const [topCard] = drawPile.splice(drawPile.findIndex(isNumber), 1);
  const turnPlayerId = players[Math.floor(rng() * players.length)].id;
  const state: GameState = {
    pub: {
      status: 'playing',
      players: players.map((p) => ({ id: p.id, name: p.name, cardCount: HAND_SIZE, calledJuan: false, missedTurns: 0 })),
      turnPlayerId,
      direction: 1,
      topCard,
      currentColor: topCard.color as Color,
      pendingDraw: null,
      turnDeadline: now + TURN_MS,
      drawnCardId: null,
      catchable: null,
      drawPileCount: 0,
      lastAction: { seq: prevSeq + 1, type: 'start', playerId: turnPlayerId },
      winnerId: null,
    },
    priv: { hands, drawPile, discard: [] },
  };
  syncCounts(state);
  return state;
}

export function applyAction(state: GameState, playerId: string, action: Action, now: number, rng: Rng): ActionResult {
  if (state.pub.status !== 'playing') return { ok: false, error: 'The game is over' };
  if (!state.priv.hands[playerId]) return { ok: false, error: 'You are not in this game' };
  const s = structuredClone(state);
  const error = dispatch(s, playerId, action, now, rng);
  if (error) return { ok: false, error };
  if (action.type !== 'timeout') playerOf(s, playerId).missedTurns = 0;
  syncCounts(s);
  return { ok: true, state: s };
}

function dispatch(s: GameState, pid: string, action: Action, now: number, rng: Rng): string | null {
  switch (action.type) {
    case 'play': return play(s, pid, action.cardId, action.chosenColor, now, rng);
    case 'draw': return draw(s, pid, now, rng);
    case 'pass': return pass(s, pid, now);
    case 'callJuan': return callJuan(s, pid);
    case 'catch': return catchPlayer(s, pid, action.targetId, rng);
    case 'timeout': return timeout(s, now, rng);
    default: return 'Unknown action';
  }
}

function play(s: GameState, pid: string, cardId: string, chosenColor: Color | undefined, now: number, rng: Rng): string | null {
  const pub = s.pub;
  const hand = s.priv.hands[pid];
  const card = hand.find((x) => x.id === cardId);
  if (!card) return "You don't have that card";
  if (!canPlay(pub, pid, card)) return explainIllegal(pub, pid, card);
  if (isWild(card) && (!chosenColor || !COLORS.includes(chosenColor))) return 'Pick a colour';

  const isJump = pid !== pub.turnPlayerId;
  pub.catchable = null;
  hand.splice(hand.indexOf(card), 1);
  s.priv.discard.push(pub.topCard);
  pub.topCard = card;
  pub.currentColor = card.color ?? (chosenColor as Color);
  const last: Omit<LastAction, 'seq'> = { type: isJump ? 'jump' : 'play', playerId: pid, card };

  if (hand.length === 0) {
    if (!isPower(card) || drawCards(s, pid, 1, rng).length === 0) {
      pub.status = 'finished';
      pub.winnerId = pid;
      pub.pendingDraw = null;
      pub.drawnCardId = null;
      record(s, last);
      return null;
    }
    last.penalty = true;
  } else if (hand.length === 1 && !playerOf(s, pid).calledJuan) {
    pub.catchable = pid;
  }
  record(s, last);

  let next: string;
  switch (card.value) {
    case 'skip':
      next = advance(s, pid, 2);
      break;
    case 'reverse':
      pub.direction = pub.direction === 1 ? -1 : 1;
      next = pub.players.length === 2 ? pid : advance(s, pid, 1);
      break;
    case 'draw2':
    case 'wild4':
      pub.pendingDraw = { kind: card.value, count: (pub.pendingDraw?.count ?? 0) + (card.value === 'draw2' ? 2 : 4) };
      next = advance(s, pid, 1);
      break;
    default:
      next = advance(s, pid, 1);
  }
  endTurn(s, next, now);
  return null;
}

function draw(s: GameState, pid: string, now: number, rng: Rng): string | null {
  const pub = s.pub;
  if (pid !== pub.turnPlayerId) return "It's not your turn";
  if (pub.drawnCardId) return 'You already drew — play it or pass';
  pub.catchable = null;
  if (pub.pendingDraw) {
    const n = drawCards(s, pid, pub.pendingDraw.count, rng).length;
    pub.pendingDraw = null;
    record(s, { type: 'stackDraw', playerId: pid, n });
    endTurn(s, advance(s, pid, 1), now);
    return null;
  }
  const [card] = drawCards(s, pid, 1, rng);
  record(s, { type: 'draw', playerId: pid, n: card ? 1 : 0 });
  if (card && matchesTop(card, pub)) {
    pub.drawnCardId = card.id;
    pub.turnDeadline = now + TURN_MS;
  } else {
    endTurn(s, advance(s, pid, 1), now);
  }
  return null;
}

function pass(s: GameState, pid: string, now: number): string | null {
  if (pid !== s.pub.turnPlayerId) return "It's not your turn";
  if (!s.pub.drawnCardId) return 'Draw a card first';
  s.pub.catchable = null;
  record(s, { type: 'pass', playerId: pid });
  endTurn(s, advance(s, pid, 1), now);
  return null;
}

function callJuan(s: GameState, pid: string): string | null {
  const count = s.priv.hands[pid].length;
  const p = playerOf(s, pid);
  if (p.calledJuan && s.pub.catchable !== pid) return 'Already called';
  if (count === 2) {
    p.calledJuan = true;
  } else if (count === 1 && s.pub.catchable === pid) {
    p.calledJuan = true;
    s.pub.catchable = null;
  } else {
    return 'You can only call Juan with 2 cards left';
  }
  record(s, { type: 'juan', playerId: pid });
  return null;
}

function catchPlayer(s: GameState, pid: string, targetId: unknown, rng: Rng): string | null {
  if (targetId === pid) return "You can't catch yourself";
  if (typeof targetId !== 'string' || s.pub.catchable === null || s.pub.catchable !== targetId) return 'Too late to catch them';
  const n = drawCards(s, targetId, 2, rng).length;
  s.pub.catchable = null;
  record(s, { type: 'catch', playerId: pid, targetId, n });
  return null;
}

function timeout(s: GameState, now: number, rng: Rng): string | null {
  const pub = s.pub;
  if (now < pub.turnDeadline) return 'Turn has not timed out yet';
  const target = pub.turnPlayerId;
  pub.catchable = null;
  let n = 0;
  if (pub.pendingDraw) {
    n = drawCards(s, target, pub.pendingDraw.count, rng).length;
    pub.pendingDraw = null;
  } else if (!pub.drawnCardId) {
    n = drawCards(s, target, 1, rng).length;
  }
  const p = playerOf(s, target);
  p.missedTurns = (p.missedTurns ?? 0) + 1; // ?? 0: games stored before missedTurns existed
  record(s, { type: 'timeout', playerId: target, n });
  endTurn(s, advance(s, target, 1), now);
  return null;
}

// ---- helpers ----

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Gives each card a unique random 8-char id drawn from `rng` (deterministic for seeded tests). */
function withOpaqueIds(cards: Card[], rng: Rng): Card[] {
  const used = new Set<string>();
  return cards.map((card) => {
    let id: string;
    do {
      id = Array.from({ length: 8 }, () => ID_CHARS[Math.floor(rng() * ID_CHARS.length)]).join('');
    } while (used.has(id));
    used.add(id);
    return { ...card, id };
  });
}

function playerOf(s: GameState, id: string): PlayerPublic {
  const p = s.pub.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
}

function advance(s: GameState, fromId: string, steps: number): string {
  const { players, direction } = s.pub;
  const n = players.length;
  const i = players.findIndex((p) => p.id === fromId);
  return players[(((i + direction * steps) % n) + n) % n].id;
}

function drawCards(s: GameState, pid: string, n: number, rng: Rng): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (s.priv.drawPile.length === 0) {
      s.priv.drawPile = shuffle(s.priv.discard, rng);
      s.priv.discard = [];
    }
    const card = s.priv.drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }
  s.priv.hands[pid].push(...drawn);
  if (drawn.length) playerOf(s, pid).calledJuan = false;
  return drawn;
}

function endTurn(s: GameState, nextId: string, now: number) {
  s.pub.turnPlayerId = nextId;
  s.pub.turnDeadline = now + TURN_MS;
  s.pub.drawnCardId = null;
}

function record(s: GameState, a: Omit<LastAction, 'seq'>) {
  s.pub.lastAction = { ...a, seq: s.pub.lastAction.seq + 1 };
}

function syncCounts(s: GameState) {
  for (const p of s.pub.players) p.cardCount = s.priv.hands[p.id].length;
  s.pub.drawPileCount = s.priv.drawPile.length;
}
