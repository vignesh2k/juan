# Juan Online Card Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy "Juan", an Uno-like multiplayer browser game where friends create/join rooms by 5-character code, hosted at `juan.netgames.uk`.

**Architecture:**
- A pure TypeScript rules engine (`src/game/`) holds every rule and is unit-tested.
- Next.js API routes on Vercel are the only writers of game state. Each one authenticates a Firebase anonymous user, then runs the engine inside a Firestore transaction.
- Clients subscribe to the public room doc and to their own private hand doc. They never write directly.

**Tech Stack:** Next.js 16 (App Router, TS), Tailwind CSS 4, `motion` (Framer Motion), Firebase JS SDK 13 (Auth + Firestore), `firebase-admin` 14, Vitest 5, Vercel, Cloudflare DNS.

Spec: `docs/superpowers/specs/2026-10-09-juan-online-card-game-design.md`

**Deviation from spec:** there is no separate `rematch` route. The host's "Play again" button calls `room/start` again, which is allowed when the previous game is `finished`. Players who joined or left in between are taken from `room.lobby`.

---

## File Map

| File | Responsibility |
|---|---|
| `src/game/types.ts` | All shared game types and constants |
| `src/game/deck.ts` | Deck creation, shuffle, seeded RNG |
| `src/game/rules.ts` | Pure predicates: what is playable, why not |
| `src/game/engine.ts` | `startGame`, `applyAction`: state transitions |
| `src/game/roomCode.ts` | Room code generate/normalize/validate |
| `src/game/room.ts` | `RoomDoc` type + expiry helper (shared client/server) |
| `src/game/__tests__/*` | Vitest tests + helpers |
| `src/server/firebaseAdmin.ts` | Admin SDK singletons |
| `src/server/http.ts` | `HttpError`, auth check, route wrapper |
| `src/server/rooms.ts` | Firestore refs, read/write game in a transaction, name cleaning |
| `src/app/api/room/{create,join,start,leave,action}/route.ts` | API routes |
| `firestore.rules` | Security rules |
| `src/lib/firebaseConfig.ts` | Public Firebase web config |
| `src/lib/firebaseClient.ts` | Client SDK singletons |
| `src/lib/useUid.ts` | Anonymous sign-in hook |
| `src/lib/api.ts` | Authenticated fetch to API routes |
| `src/lib/useRoom.ts` | Live room + own hand subscription |
| `src/lib/hooks.ts` | `useNow`, `useViewport` |
| `src/components/Toaster.tsx` | Toast notifications |
| `src/components/Card.tsx` | `CardFace`, `CardBack` |
| `src/components/RulesButton.tsx` | "?" button + rules modal |
| `src/components/Lobby.tsx` | Lobby screen |
| `src/components/JoinPrompt.tsx` | Name form for people arriving by link |
| `src/components/game/*` | Table pieces (seats, pile, hand, action bar, effects, overlays) |
| `src/app/page.tsx` | Home |
| `src/app/room/[code]/page.tsx` | Room page (lobby or game) |

---

### Task 1: Scaffold project

**Files:** Create the Next.js scaffold in the repo root. Modify `.gitignore` and `package.json`.

- [ ] **Step 1: Scaffold into a temp dir and copy in.** The repo root already has `.git` and `docs/`, so the scaffold is generated elsewhere first.

```bash
SCR=/private/tmp/claude-501/-Users-viggy-Juan/7789d439-cadb-4811-aa41-de343f07e247/scratchpad
cd $SCR && rm -rf juan-scaffold && npx --yes create-next-app@16.4.0 juan-scaffold --ts --tailwind --app --src-dir --import-alias "@/*" --use-npm --no-eslint --yes
rsync -a --exclude node_modules --exclude .git $SCR/juan-scaffold/ /Users/viggy/Juan/
cd /Users/viggy/Juan && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/viggy/Juan && npm install firebase@13 firebase-admin@14 motion@14 && npm install -D vitest@5
```

- [ ] **Step 3: Add test script.** In `package.json` `"scripts"`, add `"test": "vitest run"`.

- [ ] **Step 4: Append to `.gitignore`**

```
# secrets
.env*
*adminsdk*.json
.vercel
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app"
```

---

### Task 2: Types and deck

**Files:**
- Create: `src/game/types.ts`, `src/game/deck.ts`, `src/game/__tests__/deck.test.ts`

- [ ] **Step 1: Write `src/game/types.ts`**

```ts
export const COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = (typeof COLORS)[number];

export const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type NumberValue = (typeof NUMBER_VALUES)[number];
export type Value = NumberValue | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  id: string;
  color: Color | null; // null for wild / wild4
  value: Value;
}

export interface Player {
  id: string;
  name: string;
}

export interface PlayerPublic extends Player {
  cardCount: number;
  calledJuan: boolean;
}

export type DrawKind = 'draw2' | 'wild4';

export interface PendingDraw {
  kind: DrawKind;
  count: number;
}

export type LastActionType =
  | 'start' | 'play' | 'jump' | 'draw' | 'stackDraw' | 'pass' | 'juan' | 'catch' | 'timeout';

export interface LastAction {
  seq: number;
  type: LastActionType;
  playerId: string;
  card?: Card;
  n?: number;
  targetId?: string;
  penalty?: boolean; // played last card as a power card and drew 1
}

export interface PublicState {
  status: 'playing' | 'finished';
  players: PlayerPublic[];
  turnPlayerId: string;
  direction: 1 | -1;
  topCard: Card;
  currentColor: Color;
  pendingDraw: PendingDraw | null;
  turnDeadline: number;
  drawnCardId: string | null;
  catchable: string | null;
  drawPileCount: number;
  lastAction: LastAction;
  winnerId: string | null;
}

export interface PrivateState {
  hands: Record<string, Card[]>;
  drawPile: Card[];
  discard: Card[]; // cards under topCard
}

export interface GameState {
  pub: PublicState;
  priv: PrivateState;
}

export type Action =
  | { type: 'play'; cardId: string; chosenColor?: Color }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'callJuan' }
  | { type: 'catch'; targetId: string }
  | { type: 'timeout' };

export type Rng = () => number;

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

export const TURN_MS = 30_000;
export const HAND_SIZE = 7;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
```

- [ ] **Step 2: Write the failing test `src/game/__tests__/deck.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createDeck, seededRng, shuffle } from '../deck';

describe('createDeck', () => {
  it('builds a standard 108-card deck with unique ids', () => {
    const d = createDeck();
    expect(d).toHaveLength(108);
    expect(new Set(d.map((c) => c.id)).size).toBe(108);
    expect(d.filter((c) => c.value === 'wild4')).toHaveLength(4);
    expect(d.filter((c) => c.value === 'wild')).toHaveLength(4);
    expect(d.filter((c) => c.color === 'red' && c.value === '0')).toHaveLength(1);
    expect(d.filter((c) => c.color === 'red' && c.value === '7')).toHaveLength(2);
    expect(d.filter((c) => c.color === 'blue' && c.value === 'draw2')).toHaveLength(2);
  });
});

describe('shuffle', () => {
  it('is deterministic for a seed and keeps all items', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], seededRng(7));
    const b = shuffle([1, 2, 3, 4, 5, 6], seededRng(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/game/__tests__/deck.test.ts`
Expected: FAIL (cannot find module `../deck`).

- [ ] **Step 4: Write `src/game/deck.ts`**

```ts
import { COLORS, NUMBER_VALUES, type Card, type Color, type Rng, type Value } from './types';

export function createDeck(): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (color: Color | null, value: Value) => cards.push({ id: `c${n++}`, color, value });
  for (const color of COLORS) {
    add(color, '0');
    for (const value of [...NUMBER_VALUES.slice(1), 'skip', 'reverse', 'draw2'] as Value[]) {
      add(color, value);
      add(color, value);
    }
  }
  for (let i = 0; i < 4; i++) {
    add(null, 'wild');
    add(null, 'wild4');
  }
  return cards;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// mulberry32: small deterministic PRNG for tests
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/game/__tests__/deck.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/game && git commit -m "feat(game): card types and deck"
```

---

### Task 3: Rules predicates

**Files:**
- Create: `src/game/rules.ts`, `src/game/__tests__/helpers.ts`, `src/game/__tests__/rules.test.ts`

- [ ] **Step 1: Write the test helpers `src/game/__tests__/helpers.ts`**

```ts
import { applyAction } from '../engine';
import { seededRng } from '../deck';
import type { Action, Card, Color, GameState, PendingDraw, Value } from '../types';

export const c = (id: string, color: Color | null, value: Value): Card => ({ id, color, value });

/** Three harmless cards (never identical to the usual red/blue test tops). */
export const filler = (p: string): Card[] => [c(`${p}1`, 'green', '7'), c(`${p}2`, 'green', '8'), c(`${p}3`, 'yellow', '3')];

export interface MakeStateOpts {
  hands: Record<string, Card[]>;
  top: Card;
  color?: Color;
  turn?: string;
  direction?: 1 | -1;
  pendingDraw?: PendingDraw | null;
  drawPile?: Card[];
  discard?: Card[];
  catchable?: string | null;
  drawnCardId?: string | null;
  calledJuan?: string[];
  deadline?: number;
}

export function makeState(o: MakeStateOpts): GameState {
  const ids = Object.keys(o.hands);
  const hands = structuredClone(o.hands);
  const drawPile = o.drawPile ?? Array.from({ length: 20 }, (_, i) => c(`p${i}`, 'yellow', '6'));
  return {
    pub: {
      status: 'playing',
      players: ids.map((id) => ({
        id,
        name: id.toUpperCase(),
        cardCount: hands[id].length,
        calledJuan: o.calledJuan?.includes(id) ?? false,
      })),
      turnPlayerId: o.turn ?? ids[0],
      direction: o.direction ?? 1,
      topCard: o.top,
      currentColor: o.color ?? (o.top.color as Color),
      pendingDraw: o.pendingDraw ?? null,
      turnDeadline: o.deadline ?? 30_000,
      drawnCardId: o.drawnCardId ?? null,
      catchable: o.catchable ?? null,
      drawPileCount: drawPile.length,
      lastAction: { seq: 0, type: 'start', playerId: ids[0] },
      winnerId: null,
    },
    priv: { hands, drawPile, discard: o.discard ?? [] },
  };
}

const rng = seededRng(1);

export function act(s: GameState, pid: string, action: Action, now = 0): GameState {
  const r = applyAction(s, pid, action, now, rng);
  if (!r.ok) throw new Error(`unexpected error: ${r.error}`);
  return r.state;
}

export function actErr(s: GameState, pid: string, action: Action, now = 0): string {
  const r = applyAction(s, pid, action, now, rng);
  if (r.ok) throw new Error('expected an error');
  return r.error;
}
```

- [ ] **Step 2: Write the failing test `src/game/__tests__/rules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { canPlay, explainIllegal, isIdentical, legalCardIds } from '../rules';
import { c, makeState } from './helpers';

describe('rules', () => {
  const base = () =>
    makeState({
      hands: { a: [c('r3', 'red', '3'), c('b5', 'blue', '5'), c('g7', 'green', '7'), c('w4', null, 'wild4')], b: [c('r5', 'red', '5')] },
      top: c('t', 'red', '5'),
    });

  it('allows colour match, value match, and wild4 on your turn', () => {
    const s = base();
    expect([...legalCardIds(s.pub, 'a', s.priv.hands.a)].sort()).toEqual(['b5', 'r3', 'w4']);
  });

  it('lets others play only identical cards (jump-in)', () => {
    const s = base();
    expect(canPlay(s.pub, 'b', c('r5', 'red', '5'))).toBe(true);
    expect(canPlay(s.pub, 'b', c('x', 'blue', '5'))).toBe(false);
  });

  it('only same draw kind is playable on a pending stack', () => {
    const s = makeState({ hands: { a: [], b: [] }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    expect(canPlay(s.pub, 'a', c('g2', 'green', 'draw2'))).toBe(true);
    expect(canPlay(s.pub, 'a', c('w4', null, 'wild4'))).toBe(false);
    expect(canPlay(s.pub, 'a', c('r9', 'red', '9'))).toBe(false);
  });

  it('after drawing only the drawn card is playable', () => {
    const s = makeState({ hands: { a: [c('r3', 'red', '3'), c('r9', 'red', '9')], b: [] }, top: c('t', 'red', '5'), drawnCardId: 'r9' });
    expect([...legalCardIds(s.pub, 'a', s.priv.hands.a)]).toEqual(['r9']);
  });

  it('wild cards are identical to the same wild type', () => {
    expect(isIdentical(c('x', null, 'wild4'), c('y', null, 'wild4'))).toBe(true);
    expect(isIdentical(c('x', null, 'wild'), c('y', null, 'wild4'))).toBe(false);
  });

  it('explains why a card is illegal', () => {
    const s = base();
    expect(explainIllegal(s.pub, 'b', c('x', 'blue', '9'))).toMatch(/exact same card/);
    expect(explainIllegal(s.pub, 'a', c('g7', 'green', '7'))).toMatch(/doesn't match/);
  });
});
```

- [ ] **Step 3: Write a stub `src/game/engine.ts` so the helpers compile**

```ts
import type { Action, ActionResult, GameState, Rng } from './types';

export function applyAction(_s: GameState, _p: string, _a: Action, _now: number, _rng: Rng): ActionResult {
  return { ok: false, error: 'not implemented' };
}
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run src/game/__tests__/rules.test.ts`
Expected: FAIL (cannot find module `../rules`).

- [ ] **Step 5: Write `src/game/rules.ts`**

```ts
import type { Card, PublicState } from './types';

export const isNumber = (card: Card) => /^[0-9]$/.test(card.value);
export const isPower = (card: Card) => !isNumber(card);
export const isWild = (card: Card) => card.value === 'wild' || card.value === 'wild4';

export function matchesTop(card: Card, pub: PublicState): boolean {
  return isWild(card) || card.color === pub.currentColor || card.value === pub.topCard.value;
}

export function isIdentical(card: Card, top: Card): boolean {
  return card.value === top.value && card.color === top.color;
}

function canPlayOnTurn(pub: PublicState, card: Card): boolean {
  if (pub.pendingDraw) return card.value === pub.pendingDraw.kind;
  if (pub.drawnCardId) return card.id === pub.drawnCardId && matchesTop(card, pub);
  return matchesTop(card, pub);
}

export function canPlay(pub: PublicState, playerId: string, card: Card): boolean {
  if (pub.status !== 'playing') return false;
  if (playerId === pub.turnPlayerId) return canPlayOnTurn(pub, card);
  return isIdentical(card, pub.topCard);
}

export function legalCardIds(pub: PublicState, playerId: string, hand: Card[]): Set<string> {
  return new Set(hand.filter((card) => canPlay(pub, playerId, card)).map((card) => card.id));
}

export function explainIllegal(pub: PublicState, playerId: string, card: Card): string {
  if (pub.status !== 'playing') return 'The game is over';
  if (playerId !== pub.turnPlayerId) return "Not your turn — you can only jump in with the exact same card";
  if (pub.pendingDraw) return `Stack a ${pub.pendingDraw.kind === 'draw2' ? '+2' : '+4'} or draw ${pub.pendingDraw.count}`;
  if (pub.drawnCardId && card.id !== pub.drawnCardId) return 'You can only play the card you just drew';
  return "That card doesn't match";
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/game/__tests__/rules.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/game && git commit -m "feat(game): playability rules"
```

---

### Task 4: Engine

**Files:**
- Modify: `src/game/engine.ts` (replace the stub)
- Create: `src/game/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing tests `src/game/__tests__/engine.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { startGame } from '../engine';
import { seededRng } from '../deck';
import { act, actErr, c, filler, makeState } from './helpers';

const R5 = c('t', 'red', '5');

describe('startGame', () => {
  it('deals 7 each and flips a number card', () => {
    const s = startGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seededRng(42), 1000);
    expect(s.priv.hands.a).toHaveLength(7);
    expect(s.priv.hands.b).toHaveLength(7);
    expect(s.pub.topCard.value).toMatch(/^[0-9]$/);
    expect(s.pub.currentColor).toBe(s.pub.topCard.color);
    expect(s.pub.players.map((p) => p.cardCount)).toEqual([7, 7]);
    expect(s.pub.drawPileCount).toBe(108 - 14 - 1);
    expect(s.pub.turnDeadline).toBe(31_000);
    expect(['a', 'b']).toContain(s.pub.turnPlayerId);
  });
});

describe('basic play', () => {
  const s = () => makeState({ hands: { a: [c('r3', 'red', '3'), c('b5', 'blue', '5'), ...filler('a')], b: filler('b'), c: filler('c') }, top: R5 });

  it('plays a colour match and passes the turn', () => {
    const n = act(s(), 'a', { type: 'play', cardId: 'r3' }, 100);
    expect(n.pub.topCard.id).toBe('r3');
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.players[0].cardCount).toBe(4);
    expect(n.priv.discard.map((x) => x.id)).toEqual(['t']);
    expect(n.pub.turnDeadline).toBe(30_100);
    expect(n.pub.lastAction).toMatchObject({ seq: 1, type: 'play', playerId: 'a' });
  });

  it('plays a value match and changes colour', () => {
    const n = act(s(), 'a', { type: 'play', cardId: 'b5' });
    expect(n.pub.currentColor).toBe('blue');
  });

  it('rejects a non-matching card', () => {
    expect(actErr(s(), 'a', { type: 'play', cardId: 'a1' })).toMatch(/can't play/);
  });

  it('rejects a card you do not hold', () => {
    expect(actErr(s(), 'a', { type: 'play', cardId: 'zzz' })).toMatch(/don't have/);
  });
});

describe('+4 and stacking', () => {
  it('+4 can be played on anything and needs a colour', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4'), ...filler('a')], b: filler('b') }, top: R5 });
    expect(actErr(s, 'a', { type: 'play', cardId: 'w4' })).toMatch(/Pick a colour/);
    const n = act(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'blue' });
    expect(n.pub.currentColor).toBe('blue');
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 4 });
    expect(n.pub.turnPlayerId).toBe('b');
  });

  it('+4 cannot go on a pending +2', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4'), ...filler('a')], b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    expect(actErr(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'red' })).toMatch(/Stack a \+2/);
  });

  it('+2 of any colour stacks on +2', () => {
    const s = makeState({ hands: { a: [c('g2', 'green', 'draw2'), ...filler('a')], b: filler('b'), c: filler('c') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    const n = act(s, 'a', { type: 'play', cardId: 'g2' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'draw2', count: 4 });
    expect(n.pub.turnPlayerId).toBe('b');
  });

  it('+2 cannot go on a pending +4', () => {
    const s = makeState({ hands: { a: [c('r2', 'red', 'draw2'), ...filler('a')], b: filler('b') }, top: c('t', null, 'wild4'), color: 'red', pendingDraw: { kind: 'wild4', count: 4 } });
    expect(actErr(s, 'a', { type: 'play', cardId: 'r2' })).toMatch(/Stack a \+4/);
  });

  it('+4 stacks on +4', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4'), ...filler('a')], b: filler('b') }, top: c('t', null, 'wild4'), color: 'red', pendingDraw: { kind: 'wild4', count: 4 } });
    const n = act(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'green' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 8 });
  });

  it('a normal card cannot be played on a pending stack', () => {
    const s = makeState({ hands: { a: [c('r9', 'red', '9'), ...filler('a')], b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 } });
    expect(actErr(s, 'a', { type: 'play', cardId: 'r9' })).toMatch(/Stack/);
  });

  it('drawing on a pending stack takes the whole stack and ends the turn', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 4 } });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.priv.hands.a).toHaveLength(7);
    expect(n.pub.pendingDraw).toBeNull();
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.lastAction).toMatchObject({ type: 'stackDraw', playerId: 'a', n: 4 });
  });
});

describe('jump-in', () => {
  const four = (extra: Partial<Parameters<typeof makeState>[0]> = {}) =>
    makeState({ hands: { a: filler('a'), b: filler('b'), c: [c('r5b', 'red', '5'), c('r5c', 'blue', '5'), ...filler('c')], d: [c('r2d', 'red', 'draw2'), ...filler('d')] }, top: R5, ...extra });

  it('an identical card jumps in and skips everyone between', () => {
    const n = act(four(), 'c', { type: 'play', cardId: 'r5b' });
    expect(n.pub.topCard.id).toBe('r5b');
    expect(n.pub.turnPlayerId).toBe('d');
    expect(n.pub.lastAction.type).toBe('jump');
  });

  it('a same-number different-colour card cannot jump in', () => {
    expect(actErr(four(), 'c', { type: 'play', cardId: 'r5c' })).toMatch(/exact same card/);
  });

  it('jumping onto a +2 stack adds to it and passes it on from the jumper', () => {
    const s = four({ top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 2 }, turn: 'b' });
    const n = act(s, 'd', { type: 'play', cardId: 'r2d' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'draw2', count: 4 });
    expect(n.pub.turnPlayerId).toBe('a');
  });

  it('jumping a +4 onto a +4 stack adds 4', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b'), c: [c('w4', null, 'wild4'), ...filler('c')], d: filler('d') }, top: c('t', null, 'wild4'), color: 'green', pendingDraw: { kind: 'wild4', count: 4 }, turn: 'b' });
    const n = act(s, 'c', { type: 'play', cardId: 'w4', chosenColor: 'red' });
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 8 });
    expect(n.pub.turnPlayerId).toBe('d');
    expect(n.pub.currentColor).toBe('red');
  });

  it('a wild can jump in on a wild', () => {
    const s = makeState({ hands: { a: filler('a'), b: [c('w', null, 'wild'), ...filler('b')] }, top: c('t', null, 'wild'), color: 'blue' });
    const n = act(s, 'b', { type: 'play', cardId: 'w', chosenColor: 'yellow' });
    expect(n.pub.currentColor).toBe('yellow');
    expect(n.pub.turnPlayerId).toBe('a');
  });
});

describe('action cards', () => {
  it('skip skips the next player', () => {
    const s = makeState({ hands: { a: [c('rs', 'red', 'skip'), ...filler('a')], b: filler('b'), c: filler('c') }, top: R5 });
    expect(act(s, 'a', { type: 'play', cardId: 'rs' }).pub.turnPlayerId).toBe('c');
  });

  it('reverse flips direction with 3 players', () => {
    const s = makeState({ hands: { a: [c('rr', 'red', 'reverse'), ...filler('a')], b: filler('b'), c: filler('c') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'rr' });
    expect(n.pub.direction).toBe(-1);
    expect(n.pub.turnPlayerId).toBe('c');
  });

  it('reverse acts as skip with 2 players', () => {
    const s = makeState({ hands: { a: [c('rr', 'red', 'reverse'), ...filler('a')], b: filler('b') }, top: R5 });
    expect(act(s, 'a', { type: 'play', cardId: 'rr' }).pub.turnPlayerId).toBe('a');
  });

  it('skip with 2 players gives you another turn', () => {
    const s = makeState({ hands: { a: [c('rs', 'red', 'skip'), ...filler('a')], b: filler('b') }, top: R5 });
    expect(act(s, 'a', { type: 'play', cardId: 'rs' }).pub.turnPlayerId).toBe('a');
  });
});

describe('drawing', () => {
  it('a playable drawn card may be played immediately (only that card)', () => {
    const s = makeState({ hands: { a: [c('r3', 'red', '3'), ...filler('a')], b: filler('b') }, top: R5, drawPile: [c('d1', 'red', '9')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.pub.drawnCardId).toBe('d1');
    expect(n.pub.turnPlayerId).toBe('a');
    expect(actErr(n, 'a', { type: 'play', cardId: 'r3' })).toMatch(/just drew/);
    expect(act(n, 'a', { type: 'play', cardId: 'd1' }).pub.turnPlayerId).toBe('b');
  });

  it('can pass after drawing a playable card', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [c('d1', 'red', '9')] });
    const n = act(act(s, 'a', { type: 'draw' }), 'a', { type: 'pass' });
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.drawnCardId).toBeNull();
  });

  it('cannot pass without drawing', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5 });
    expect(actErr(s, 'a', { type: 'pass' })).toMatch(/Draw a card first/);
  });

  it('an unplayable drawn card ends the turn', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [c('d1', 'blue', '9')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.priv.hands.a).toHaveLength(4);
    expect(n.pub.turnPlayerId).toBe('b');
  });

  it('cannot draw twice', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [c('d1', 'red', '9')] });
    expect(actErr(act(s, 'a', { type: 'draw' }), 'a', { type: 'draw' })).toMatch(/already drew/);
  });

  it('cannot draw out of turn', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5 });
    expect(actErr(s, 'b', { type: 'draw' })).toMatch(/not your turn/);
  });

  it('reshuffles the discard pile when the draw pile is empty', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, drawPile: [], discard: [c('x1', 'blue', '1'), c('x2', 'blue', '2')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.priv.hands.a).toHaveLength(4);
    expect(n.priv.drawPile.length + n.priv.discard.length).toBe(1);
    expect(n.priv.discard).toHaveLength(0);
  });
});

describe('Juan call', () => {
  const two = () => makeState({ hands: { a: [c('r3', 'red', '3'), c('g7', 'green', '7')], b: [c('r9', 'red', '9'), ...filler('b')], c: filler('c') }, top: R5 });

  it('going to 1 card without calling makes you catchable; catch gives +2', () => {
    const n = act(two(), 'a', { type: 'play', cardId: 'r3' });
    expect(n.pub.catchable).toBe('a');
    const m = act(n, 'c', { type: 'catch', targetId: 'a' });
    expect(m.priv.hands.a).toHaveLength(3);
    expect(m.pub.catchable).toBeNull();
    expect(m.pub.lastAction).toMatchObject({ type: 'catch', playerId: 'c', targetId: 'a', n: 2 });
  });

  it('calling Juan at 2 cards prevents being catchable', () => {
    const n = act(act(two(), 'a', { type: 'callJuan' }), 'a', { type: 'play', cardId: 'r3' });
    expect(n.pub.catchable).toBeNull();
  });

  it('cannot call Juan with 3+ cards', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5 });
    expect(actErr(s, 'a', { type: 'callJuan' })).toMatch(/2 cards/);
  });

  it('calling Juan at 1 card while catchable saves you', () => {
    const n = act(act(two(), 'a', { type: 'play', cardId: 'r3' }), 'a', { type: 'callJuan' });
    expect(n.pub.catchable).toBeNull();
    expect(actErr(n, 'c', { type: 'catch', targetId: 'a' })).toMatch(/Too late/);
  });

  it('the catch window closes after the next play', () => {
    const n = act(act(two(), 'a', { type: 'play', cardId: 'r3' }), 'b', { type: 'play', cardId: 'r9' });
    expect(n.pub.catchable).toBeNull();
  });

  it('cannot catch yourself', () => {
    const n = act(two(), 'a', { type: 'play', cardId: 'r3' });
    expect(actErr(n, 'a', { type: 'catch', targetId: 'a' })).toMatch(/yourself/);
  });

  it('drawing resets your Juan call', () => {
    const s = makeState({ hands: { a: [c('g7', 'green', '7'), c('g8', 'green', '8')], b: filler('b') }, top: R5, calledJuan: ['a'], drawPile: [c('d1', 'blue', '9')] });
    const n = act(s, 'a', { type: 'draw' });
    expect(n.pub.players[0].calledJuan).toBe(false);
  });
});

describe('ending the game', () => {
  it('playing your last number card wins', () => {
    const s = makeState({ hands: { a: [c('r3', 'red', '3')], b: filler('b') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'r3' });
    expect(n.pub.status).toBe('finished');
    expect(n.pub.winnerId).toBe('a');
    expect(actErr(n, 'b', { type: 'draw' })).toMatch(/over/);
  });

  it('ending on a power card draws a 1-card penalty', () => {
    const s = makeState({ hands: { a: [c('rs', 'red', 'skip')], b: filler('b'), c: filler('c') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'rs' });
    expect(n.pub.status).toBe('playing');
    expect(n.priv.hands.a).toHaveLength(1);
    expect(n.pub.turnPlayerId).toBe('c');
    expect(n.pub.lastAction).toMatchObject({ type: 'play', penalty: true });
    expect(n.pub.catchable).toBeNull();
  });

  it('ending on a +4 still applies the +4 and the penalty', () => {
    const s = makeState({ hands: { a: [c('w4', null, 'wild4')], b: filler('b') }, top: R5 });
    const n = act(s, 'a', { type: 'play', cardId: 'w4', chosenColor: 'red' });
    expect(n.priv.hands.a).toHaveLength(1);
    expect(n.pub.pendingDraw).toEqual({ kind: 'wild4', count: 4 });
  });
});

describe('turn timer', () => {
  it('rejects timeout before the deadline', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, deadline: 30_000 });
    expect(actErr(s, 'b', { type: 'timeout' }, 29_000)).toMatch(/not timed out/);
  });

  it('auto-draws 1 and passes the turn after the deadline', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: R5, deadline: 30_000, drawPile: [c('d1', 'red', '9')] });
    const n = act(s, 'b', { type: 'timeout' }, 30_001);
    expect(n.priv.hands.a).toHaveLength(4);
    expect(n.pub.turnPlayerId).toBe('b');
    expect(n.pub.lastAction).toMatchObject({ type: 'timeout', playerId: 'a', n: 1 });
  });

  it('auto-draws the pending stack on timeout', () => {
    const s = makeState({ hands: { a: filler('a'), b: filler('b') }, top: c('t', 'red', 'draw2'), pendingDraw: { kind: 'draw2', count: 4 }, deadline: 30_000 });
    const n = act(s, 'b', { type: 'timeout' }, 30_001);
    expect(n.priv.hands.a).toHaveLength(7);
    expect(n.pub.pendingDraw).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/game/__tests__/engine.test.ts`
Expected: FAIL (`startGame` not exported, or `not implemented` errors).

- [ ] **Step 3: Write `src/game/engine.ts`**

```ts
import { createDeck, shuffle } from './deck';
import { canPlay, explainIllegal, isNumber, isPower, isWild, matchesTop } from './rules';
import {
  COLORS, HAND_SIZE, MIN_PLAYERS, TURN_MS,
  type Action, type ActionResult, type Card, type Color, type GameState, type LastAction, type Player, type PlayerPublic, type Rng,
} from './types';

export function startGame(players: Player[], rng: Rng, now: number): GameState {
  if (players.length < MIN_PLAYERS) throw new Error('Need at least 2 players');
  const drawPile = shuffle(createDeck(), rng);
  const hands: Record<string, Card[]> = {};
  for (const p of players) hands[p.id] = drawPile.splice(0, HAND_SIZE);
  const [topCard] = drawPile.splice(drawPile.findIndex(isNumber), 1);
  const state: GameState = {
    pub: {
      status: 'playing',
      players: players.map((p) => ({ id: p.id, name: p.name, cardCount: HAND_SIZE, calledJuan: false })),
      turnPlayerId: players[Math.floor(rng() * players.length)].id,
      direction: 1,
      topCard,
      currentColor: topCard.color as Color,
      pendingDraw: null,
      turnDeadline: now + TURN_MS,
      drawnCardId: null,
      catchable: null,
      drawPileCount: 0,
      lastAction: { seq: 0, type: 'start', playerId: players[0].id },
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
  if (!canPlay(pub, pid, card)) {
    return pid === pub.turnPlayerId ? `You can't play that card now. ${explainIllegal(pub, pid, card)}` : explainIllegal(pub, pid, card);
  }
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

function catchPlayer(s: GameState, pid: string, targetId: string, rng: Rng): string | null {
  if (targetId === pid) return "You can't catch yourself";
  if (s.pub.catchable !== targetId) return 'Too late to catch them';
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
  record(s, { type: 'timeout', playerId: target, n });
  endTurn(s, advance(s, target, 1), now);
  return null;
}

// ---- helpers ----

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
```

- [ ] **Step 4: Run all game tests**

Run: `npx vitest run`
Expected: all PASS. If a test fails, fix the engine (not the test) unless the test contradicts the spec.

- [ ] **Step 5: Commit**

```bash
git add src/game && git commit -m "feat(game): rules engine with stacking, jump-in, Juan, timer"
```

---

### Task 5: Room codes and room type

**Files:**
- Create: `src/game/roomCode.ts`, `src/game/room.ts`, `src/game/__tests__/roomCode.test.ts`

- [ ] **Step 1: Write the failing test `src/game/__tests__/roomCode.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../roomCode';

describe('room codes', () => {
  it('generates valid 5-char codes', () => {
    for (let i = 0; i < 200; i++) expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });
  it('rejects ambiguous characters and wrong lengths', () => {
    expect(isValidRoomCode('ABC0O')).toBe(false);
    expect(isValidRoomCode('ABCI1')).toBe(false);
    expect(isValidRoomCode('ABCD')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(true);
  });
  it('normalizes user input', () => {
    expect(normalizeRoomCode(' ab-cd e ')).toBe('ABCDE');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/game/__tests__/roomCode.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/game/roomCode.ts`**

```ts
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
export const CODE_LENGTH = 5;

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}
```

- [ ] **Step 4: Write `src/game/room.ts`**

```ts
import type { Player, PublicState } from './types';

export interface RoomDoc {
  code: string;
  hostId: string;
  lobby: Player[];
  game: PublicState | null;
  createdAt: number;
  updatedAt: number;
}

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export const isRoomExpired = (room: RoomDoc, now: number) => now - room.updatedAt > ROOM_TTL_MS;

/** Room is accepting players: no game yet, or the last game finished. */
export const isRoomOpen = (room: RoomDoc) => !room.game || room.game.status === 'finished';
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game && git commit -m "feat(game): room codes and room doc type"
```

---

### Task 6: Server: admin SDK, HTTP wrapper, room store, API routes

**Files:**
- Create: `src/server/firebaseAdmin.ts`, `src/server/http.ts`, `src/server/rooms.ts`
- Create: `src/app/api/room/create/route.ts`, `join/route.ts`, `start/route.ts`, `leave/route.ts`, `action/route.ts`

- [ ] **Step 1: Write `src/server/firebaseAdmin.ts`**

```ts
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not set');
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  return initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  });
}

let db: Firestore | null = null;

export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(adminApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export const adminAuth = () => getAuth(adminApp());
```

- [ ] **Step 2: Write `src/server/http.ts`**

```ts
import { adminAuth } from './firebaseAdmin';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireUid(req: Request): Promise<string> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Not signed in');
  try {
    return (await adminAuth().verifyIdToken(header.slice(7))).uid;
  } catch {
    throw new HttpError(401, 'Not signed in');
  }
}

type Body = Record<string, unknown>;

export function handler(fn: (uid: string, body: Body) => Promise<object | void>) {
  return async (req: Request) => {
    try {
      const uid = await requireUid(req);
      const body = ((await req.json().catch(() => ({}))) ?? {}) as Body;
      const data = (await fn(uid, body)) ?? {};
      return Response.json({ ok: true, ...data });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ ok: false, error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ ok: false, error: 'Something went wrong' }, { status: 500 });
    }
  };
}
```

- [ ] **Step 3: Write `src/server/rooms.ts`**

```ts
import type { Transaction } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { HttpError } from './http';
import { isRoomExpired, type RoomDoc } from '@/game/room';
import { isValidRoomCode, normalizeRoomCode } from '@/game/roomCode';
import type { Card, GameState } from '@/game/types';

export const roomRef = (code: string) => adminDb().collection('rooms').doc(code);
const handRef = (code: string, uid: string) => roomRef(code).collection('hands').doc(uid);
const secretRef = (code: string) => roomRef(code).collection('secret').doc('deck');

export function parseCode(raw: unknown): string {
  const code = normalizeRoomCode(String(raw ?? ''));
  if (!isValidRoomCode(code)) throw new HttpError(400, 'Room codes are 5 letters/numbers');
  return code;
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) throw new HttpError(400, 'Enter a nickname');
  return name;
}

export async function readRoom(tx: Transaction, code: string, now: number): Promise<RoomDoc> {
  const snap = await tx.get(roomRef(code));
  const room = snap.data() as RoomDoc | undefined;
  if (!room || isRoomExpired(room, now)) throw new HttpError(404, 'Room not found');
  return room;
}

/** Reads the full game state. Must be called before any writes in the transaction. */
export async function readGame(tx: Transaction, code: string, room: RoomDoc): Promise<GameState> {
  if (!room.game) throw new HttpError(409, 'The game has not started');
  const ids = room.game.players.map((p) => p.id);
  const [secretSnap, ...handSnaps] = await tx.getAll(secretRef(code), ...ids.map((id) => handRef(code, id)));
  const secret = secretSnap.data() as { drawPile: Card[]; discard: Card[] };
  const hands = Object.fromEntries(ids.map((id, i) => [id, (handSnaps[i].data()?.cards ?? []) as Card[]]));
  return { pub: room.game, priv: { hands, drawPile: secret.drawPile, discard: secret.discard } };
}

export function writeGame(tx: Transaction, code: string, room: RoomDoc, state: GameState, now: number) {
  tx.set(roomRef(code), { ...room, game: state.pub, updatedAt: now } satisfies RoomDoc);
  for (const [id, cards] of Object.entries(state.priv.hands)) tx.set(handRef(code, id), { cards });
  tx.set(secretRef(code), { drawPile: state.priv.drawPile, discard: state.priv.discard });
}
```

- [ ] **Step 4: Write `src/app/api/room/create/route.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/app/api/room/join/route.ts`**

```ts
import { adminDb } from '@/server/firebaseAdmin';
import { handler, HttpError } from '@/server/http';
import { cleanName, parseCode, readRoom, roomRef } from '@/server/rooms';
import { isRoomOpen } from '@/game/room';
import { MAX_PLAYERS } from '@/game/types';

export const POST = handler(async (uid, body) => {
  const code = parseCode(body.code);
  const name = cleanName(body.name);
  const now = Date.now();
  await adminDb().runTransaction(async (tx) => {
    const room = await readRoom(tx, code, now);
    if (room.game?.players.some((p) => p.id === uid) && !isRoomOpen(room)) return; // rejoin mid-game
    const inLobby = room.lobby.some((p) => p.id === uid);
    if (!inLobby && !isRoomOpen(room)) throw new HttpError(409, 'That game has already started');
    if (!inLobby && room.lobby.length >= MAX_PLAYERS) throw new HttpError(409, 'That room is full');
    const lobby = inLobby ? room.lobby.map((p) => (p.id === uid ? { ...p, name } : p)) : [...room.lobby, { id: uid, name }];
    tx.update(roomRef(code), { lobby, updatedAt: now });
  });
  return { code };
});
```

- [ ] **Step 6: Write `src/app/api/room/start/route.ts`**

```ts
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
    if (room.lobby.length < MIN_PLAYERS) throw new HttpError(409, 'Need at least 2 players');
    writeGame(tx, code, room, startGame(room.lobby, Math.random, now), now);
  });
});
```

- [ ] **Step 7: Write `src/app/api/room/leave/route.ts`**

```ts
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
```

- [ ] **Step 8: Write `src/app/api/room/action/route.ts`**

```ts
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
  await adminDb().runTransaction(async (tx) => {
    const now = Date.now();
    const room = await readRoom(tx, code, now);
    const state = await readGame(tx, code, room);
    const result = applyAction(state, uid, action, now, Math.random);
    if (!result.ok) throw new HttpError(400, result.error);
    writeGame(tx, code, room, result.state, now);
  });
});
```

- [ ] **Step 9: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors, build succeeds. Routes are not called at build time, so the missing env var is fine.

- [ ] **Step 10: Commit**

```bash
git add src/server src/app/api && git commit -m "feat(server): authoritative room API routes"
```

---

### Task 7: Firestore security rules

**Files:**
- Create: `firestore.rules`

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{code} {
      allow read: if request.auth != null;
      allow write: if false;

      match /hands/{uid} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow write: if false;
      }

      match /secret/{doc} {
        allow read, write: if false;
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules && git commit -m "feat: firestore security rules"
```

---

### Task 8: Client libraries

**Files:**
- Create: `src/lib/firebaseConfig.ts`, `src/lib/firebaseClient.ts`, `src/lib/useUid.ts`, `src/lib/api.ts`, `src/lib/useRoom.ts`, `src/lib/hooks.ts`, `src/components/Toaster.tsx`

- [ ] **Step 1: Write `src/lib/firebaseConfig.ts`.** This is the public web config, which is safe to commit. Real values are filled in during Task 14. Until then the file holds the structure with the project ID `juan-netgames`:

```ts
export const firebaseConfig = {
  apiKey: 'REPLACED_IN_TASK_14',
  authDomain: 'juan-netgames.firebaseapp.com',
  projectId: 'juan-netgames',
  storageBucket: 'juan-netgames.firebasestorage.app',
  messagingSenderId: 'REPLACED_IN_TASK_14',
  appId: 'REPLACED_IN_TASK_14',
};
```

- [ ] **Step 2: Write `src/lib/firebaseClient.ts`.** The `?fresh` URL flag gives a tab its own anonymous identity (session persistence), which makes testing with several tabs in one browser possible.

```ts
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const app = (): FirebaseApp => getApps()[0] ?? initializeApp(firebaseConfig);

function freshTab(): boolean {
  try {
    if (new URLSearchParams(location.search).has('fresh')) sessionStorage.setItem('juan:fresh', '1');
    return sessionStorage.getItem('juan:fresh') === '1';
  } catch {
    return false;
  }
}

let auth: Auth | null = null;
export function clientAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(app(), {
      persistence: freshTab() ? browserSessionPersistence : [indexedDBLocalPersistence, browserLocalPersistence],
    });
  }
  return auth;
}

export const clientDb = (): Firestore => getFirestore(app());
```

- [ ] **Step 3: Write `src/lib/useUid.ts`**

```ts
'use client';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { clientAuth } from './firebaseClient';

export function useUid(): string | null {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const auth = clientAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else signInAnonymously(auth).catch((e) => console.error('anonymous sign-in failed', e));
    });
  }, []);
  return uid;
}
```

- [ ] **Step 4: Write `src/lib/api.ts`**

```ts
import { clientAuth } from './firebaseClient';
import type { Action } from '@/game/types';

export async function api<T extends object = object>(path: string, body: object): Promise<T> {
  const user = clientAuth().currentUser;
  if (!user) throw new Error('Still connecting… try again in a second');
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Network error' }));
  if (!data.ok) throw new Error(data.error ?? 'Something went wrong');
  return data as T;
}

export const sendAction = (code: string, action: Action) => api('room/action', { code, action });
```

- [ ] **Step 5: Write `src/lib/useRoom.ts`**

```ts
'use client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { clientDb } from './firebaseClient';
import type { RoomDoc } from '@/game/room';
import type { Card } from '@/game/types';

/** room: undefined = loading, null = not found */
export function useRoom(code: string, uid: string | null) {
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  const [hand, setHand] = useState<Card[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(clientDb(), 'rooms', code),
      { includeMetadataChanges: true },
      (snap) => {
        setOffline(snap.metadata.fromCache);
        setRoom(snap.exists() ? (snap.data() as RoomDoc) : snap.metadata.fromCache ? undefined : null);
      },
      () => setRoom(null),
    );
  }, [code, uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(clientDb(), 'rooms', code, 'hands', uid),
      (snap) => setHand((snap.data()?.cards as Card[] | undefined) ?? []),
      () => setHand([]),
    );
  }, [code, uid]);

  return { room, hand, offline };
}
```

- [ ] **Step 6: Write `src/lib/hooks.ts`**

```ts
'use client';
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useViewport() {
  const [size, setSize] = useState({ width: 1024, height: 768 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}
```

- [ ] **Step 7: Write `src/components/Toaster.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

const listeners = new Set<(msg: string) => void>();
export const toast = (msg: string) => listeners.forEach((l) => l(msg));

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const listener = (msg: string) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { id, msg }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2800);
    };
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl bg-black/80 px-4 py-2 text-center text-sm font-semibold shadow-xl ring-1 ring-white/10">
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib src/components && git commit -m "feat(client): firebase client, auth, api, room subscription"
```

---

### Task 9: Global styles, layout, card components

**Files:**
- Modify (replace): `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/Card.tsx`

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --font-display: var(--font-lilita), system-ui, sans-serif;
  --font-sans: var(--font-nunito), system-ui, sans-serif;
}

html, body { height: 100%; background: #0d0618; color: #fff; overscroll-behavior: none; }
body { font-family: var(--font-sans); -webkit-tap-highlight-color: transparent; }

.bg-stage {
  background:
    radial-gradient(circle at 50% 35%, rgba(124, 58, 237, .35), transparent 60%),
    radial-gradient(circle at 50% 120%, rgba(236, 72, 153, .25), transparent 55%),
    #0d0618;
}

/* ---------- table ---------- */
.felt-wrap { position: absolute; inset: 0; perspective: 1100px; pointer-events: none; }
.felt {
  position: absolute; left: 50%; top: 46%;
  width: min(125vw, 1150px); height: min(78vh, 660px);
  transform: translate(-50%, -50%) rotateX(40deg);
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 45%, #23935c 0%, #16693f 50%, #0c3f26 100%);
  box-shadow:
    inset 0 0 90px rgba(0, 0, 0, .55),
    0 0 0 14px #6b4423, 0 0 0 20px #3f2713,
    0 40px 80px rgba(0, 0, 0, .7);
}
.felt::after {
  content: ''; position: absolute; inset: 9%; border-radius: 50%;
  border: 2px dashed rgba(255, 255, 255, .12);
}

/* ---------- cards ---------- */
.juan-card {
  position: relative; flex: none; overflow: hidden;
  border-radius: 0.6em; border: 0.32em solid #fff;
  box-shadow: 0 0.4em 1em rgba(0, 0, 0, .45);
  font-family: var(--font-display); color: #fff; user-select: none;
}
.juan-card--xs { width: 1.5rem; height: 2.25rem; font-size: 3.5px; border-width: 1.5px; border-radius: 3px; }
.juan-card--sm { width: 2.6rem; height: 3.9rem; font-size: 6.5px; }
.juan-card--md { width: 4.4rem; height: 6.6rem; font-size: 10.5px; }
.juan-card--lg { width: 5.6rem; height: 8.4rem; font-size: 13.5px; }
.juan-card__oval {
  position: absolute; left: 50%; top: 50%; width: 92%; height: 64%;
  transform: translate(-50%, -50%) rotate(-58deg);
  border-radius: 50%; background: #fff;
}
.juan-card__oval--wild { background: conic-gradient(#e53935 0 25%, #fdd835 0 50%, #43a047 0 75%, #1e88e5 0); }
.juan-card__label {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 4em; line-height: 1;
  text-shadow: 0.06em 0.06em 0 #1a1a1a, -0.03em -0.03em 0 #1a1a1a;
}
.juan-card__corner { position: absolute; font-size: 1.6em; line-height: 1; text-shadow: 0.08em 0.08em 0 rgba(0,0,0,.6); }
.juan-card__corner--tl { left: 0.35em; top: 0.3em; }
.juan-card__corner--br { right: 0.35em; bottom: 0.3em; transform: rotate(180deg); }
.juan-card__shine {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(135deg, rgba(255,255,255,.35) 0%, transparent 35%, transparent 70%, rgba(0,0,0,.18) 100%);
}
.juan-back { background: #1b1b1f; }
.juan-back .juan-card__oval { background: #e53935; }
.juan-back__logo {
  position: absolute; inset: 0; display: grid; place-items: center;
  color: #fdd835; font-size: 2em; transform: rotate(-30deg);
  text-shadow: 0.08em 0.08em 0 #1a1a1a;
}

/* in the components layer so Tailwind utilities can override them */
@layer components {
  /* ---------- buttons ---------- */
  .btn {
    border-radius: 1rem; padding: .6rem 1.3rem; color: #fff;
    font-family: var(--font-display); font-size: 1.1rem; letter-spacing: .03em;
    box-shadow: 0 4px 0 rgba(0,0,0,.35), 0 8px 18px rgba(0,0,0,.3);
    transition: transform .1s, filter .15s;
  }
  .btn:hover { filter: brightness(1.1); }
  .btn:active { transform: translateY(2px) scale(.97); }
  .btn:disabled { opacity: .4; pointer-events: none; }
  .btn-red { background: linear-gradient(#ff5a4e, #d32f2f); }
  .btn-blue { background: linear-gradient(#4aa3ff, #1e6fd9); }
  .btn-green { background: linear-gradient(#4cd471, #23a047); }
  .btn-yellow { background: linear-gradient(#ffe066, #f5b800); color: #3a2a00; }
  .btn-gray { background: linear-gradient(#6b6b7b, #44444f); }

  .input {
    width: 100%; border-radius: 1rem; background: rgba(255,255,255,.08); padding: .8rem 1rem;
    font-size: 1.1rem; outline: none; border: 2px solid rgba(255,255,255,.12);
  }
  .input:focus { border-color: #a78bfa; }
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import { Toaster } from '@/components/Toaster';
import './globals.css';

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-lilita' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: 'Juan — play with friends',
  description: 'A fast, chaotic card game for friends. Create a room, share the code, play.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0618',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${nunito.variable}`}>
      <body className="bg-stage min-h-full antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write `src/components/Card.tsx`**

```tsx
import type { Card, Color, Value } from '@/game/types';

export const COLOR_HEX: Record<Color, string> = { red: '#e53935', yellow: '#fdd835', green: '#43a047', blue: '#1e88e5' };

const LABEL: Record<Value, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4',
};

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

export function CardFace({ card, size = 'md' }: { card: Card; size?: CardSize }) {
  const label = LABEL[card.value];
  const bg = card.color ? COLOR_HEX[card.color] : '#16161a';
  return (
    <div className={`juan-card juan-card--${size}`} style={{ background: bg }}>
      <div className={`juan-card__oval ${card.color ? '' : 'juan-card__oval--wild'}`} />
      <span className="juan-card__label" style={{ color: card.color ? bg : '#fff' }}>{label}</span>
      <span className="juan-card__corner juan-card__corner--tl">{label}</span>
      <span className="juan-card__corner juan-card__corner--br">{label}</span>
      <div className="juan-card__shine" />
    </div>
  );
}

export function CardBack({ size = 'md' }: { size?: CardSize }) {
  return (
    <div className={`juan-card juan-card--${size} juan-back`}>
      <div className="juan-card__oval" />
      <span className="juan-back__logo">JUAN</span>
      <div className="juan-card__shine" />
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat(ui): theme, layout, card components"
```

---

### Task 10: Rules modal and Home page

**Files:**
- Create: `src/components/RulesButton.tsx`
- Modify (replace): `src/app/page.tsx`

- [ ] **Step 1: Write `src/components/RulesButton.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

const RULES: [string, string][] = [
  ['Goal', 'Be the first to get rid of all your cards. No scoring — first out wins.'],
  ['Matching', 'Play a card that matches the top card by colour or by number/symbol, or play a Wild.'],
  ['+4 any time', 'A Wild +4 can be played on anything (you pick the colour) — except on a +2 stack.'],
  ['Stacking', 'Hit with a +2? Stack another +2 (any colour) to pass it on, growing the total. Same for +4 on +4. You can NOT mix: no +4 on a +2, no +2 on a +4. Can’t stack? Draw the whole total and lose your turn.'],
  ['Jump in', 'Have the EXACT same card as the top card (same colour and number/symbol)? Play it any time, even when it’s not your turn. Everyone between is skipped and play continues from you. Works on stacks too.'],
  ['Drawing', 'Can’t or don’t want to play? Draw 1. If it’s playable you may play it right away, otherwise your turn passes.'],
  ['Skip / Reverse', 'Skip jumps the next player. Reverse flips direction (with 2 players it acts like a Skip).'],
  ['Juan!', 'Press JUAN! when you’re down to 2 cards (before playing your second-to-last). If you reach 1 card without calling it, anyone can hit CATCH and you draw 2.'],
  ['No power finish', 'You can’t finish on a power card (Skip, Reverse, +2, Wild, +4). If you play one as your last card it still takes effect, but you draw 1 card.'],
  ['Turn timer', 'You have 30 seconds per turn. Run out and you automatically draw (or take the stack) and your turn passes.'],
];

export function RulesButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button aria-label="How to play" onClick={() => setOpen(true)}
        className={`grid h-10 w-10 place-items-center rounded-full bg-white/10 font-display text-xl ring-1 ring-white/20 backdrop-blur hover:bg-white/20 ${className}`}>
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#1c1030] p-6 shadow-2xl ring-1 ring-white/10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-3xl">How to play Juan</h2>
                <button onClick={() => setOpen(false)} className="text-2xl text-white/60 hover:text-white" aria-label="Close">✕</button>
              </div>
              <ul className="space-y-3">
                {RULES.map(([title, text]) => (
                  <li key={title} className="rounded-2xl bg-white/5 p-3">
                    <div className="font-display text-lg text-yellow-300">{title}</div>
                    <p className="text-sm leading-relaxed text-white/85">{text}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CardFace } from '@/components/Card';
import { RulesButton } from '@/components/RulesButton';
import { toast } from '@/components/Toaster';
import { api } from '@/lib/api';
import { useUid } from '@/lib/useUid';
import { normalizeRoomCode, isValidRoomCode } from '@/game/roomCode';
import type { Card } from '@/game/types';

const HERO: Card[] = [
  { id: 'h1', color: 'red', value: '7' },
  { id: 'h2', color: null, value: 'wild4' },
  { id: 'h3', color: 'blue', value: 'reverse' },
  { id: 'h4', color: 'yellow', value: 'draw2' },
  { id: 'h5', color: 'green', value: 'skip' },
];

export default function Home() {
  const router = useRouter();
  const uid = useUid();
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setName(localStorage.getItem('juan:name') ?? ''); } catch {}
  }, []);

  async function go(kind: 'create' | 'join') {
    if (!name.trim()) return toast('Enter a nickname first');
    if (kind === 'join' && !isValidRoomCode(code)) return toast('Room codes are 5 letters/numbers');
    try { localStorage.setItem('juan:name', name.trim()); } catch {}
    setBusy(true);
    try {
      const res = await api<{ code: string }>(`room/${kind}`, { name, code });
      router.push(`/room/${res.code}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <RulesButton className="absolute right-4 top-4" />
      <div className="relative mb-6 h-40 w-72">
        {HERO.map((card, i) => (
          <motion.div key={card.id} className="absolute left-1/2 top-4"
            initial={{ y: 200, rotate: 0, opacity: 0 }}
            animate={{ y: Math.abs(i - 2) * 8, x: (i - 2) * 42 - 35, rotate: (i - 2) * 12, opacity: 1 }}
            transition={{ delay: 0.1 * i, type: 'spring', stiffness: 160, damping: 16 }}>
            <CardFace card={card} size="md" />
          </motion.div>
        ))}
      </div>
      <motion.h1 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: 'spring' }}
        className="font-display text-7xl tracking-wide text-yellow-300 drop-shadow-[0_6px_0_#b91c1c]">
        JUAN
      </motion.h1>
      <p className="mb-8 mt-2 text-white/70">The card game for chaotic friends</p>

      <div className="w-full max-w-sm space-y-3">
        <input className="input" placeholder="Your nickname" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
        {!joining ? (
          <>
            <button className="btn btn-red w-full" disabled={!uid || busy} onClick={() => go('create')}>Create room</button>
            <button className="btn btn-blue w-full" disabled={!uid || busy} onClick={() => setJoining(true)}>Join room</button>
          </>
        ) : (
          <>
            <input className="input text-center font-display text-3xl uppercase tracking-[0.4em]" placeholder="CODE" maxLength={5} autoFocus
              value={code} onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, 5))}
              onKeyDown={(e) => e.key === 'Enter' && go('join')} />
            <button className="btn btn-green w-full" disabled={!uid || busy || code.length !== 5} onClick={() => go('join')}>Join</button>
            <button className="w-full py-2 text-sm text-white/60 hover:text-white" onClick={() => setJoining(false)}>Back</button>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat(ui): home page and rules modal"
```

---

### Task 11: Lobby, join prompt, room page shell

**Files:**
- Create: `src/components/Lobby.tsx`, `src/components/JoinPrompt.tsx`, `src/app/room/[code]/page.tsx`

- [ ] **Step 1: Write `src/components/Lobby.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RulesButton } from './RulesButton';
import { toast } from './Toaster';
import { api } from '@/lib/api';
import type { RoomDoc } from '@/game/room';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/game/types';

export function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

export function Lobby({ room, uid }: { room: RoomDoc; uid: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isHost = room.hostId === uid;

  async function copy() {
    const link = `${location.origin}/room/${room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied');
    } catch {
      toast(link);
    }
  }

  async function run(path: string) {
    setBusy(true);
    try {
      await api(path, { code: room.code });
      if (path === 'room/leave') router.push('/');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-4 py-10">
      <RulesButton className="absolute right-4 top-4" />
      <p className="text-sm uppercase tracking-widest text-white/60">Room code</p>
      <button onClick={copy} className="mt-1 font-display text-6xl tracking-[0.3em] text-yellow-300 drop-shadow-[0_4px_0_#b91c1c]" title="Copy invite link">
        {room.code}
      </button>
      <p className="mt-2 text-sm text-white/60">Tap the code to copy an invite link</p>

      <div className="mt-8 w-full max-w-sm rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="mb-3 flex justify-between text-sm text-white/60">
          <span>Players</span>
          <span>{room.lobby.length}/{MAX_PLAYERS}</span>
        </div>
        <ul className="space-y-2">
          {room.lobby.map((p, i) => (
            <motion.li key={p.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
              <span className="grid h-9 w-9 place-items-center rounded-full font-display text-lg" style={{ background: avatarColor(p.id) }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="flex-1 font-semibold">{p.name}{p.id === uid && <span className="text-white/50"> (you)</span>}</span>
              {p.id === room.hostId && <span title="Host">👑</span>}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="mt-6 w-full max-w-sm space-y-3">
        {isHost ? (
          <button className="btn btn-green w-full" disabled={busy || room.lobby.length < MIN_PLAYERS} onClick={() => run('room/start')}>
            {room.lobby.length < MIN_PLAYERS ? 'Waiting for players…' : 'Start game'}
          </button>
        ) : (
          <p className="text-center text-white/70">Waiting for the host to start…</p>
        )}
        <button className="w-full py-2 text-sm text-white/60 hover:text-white" disabled={busy} onClick={() => run('room/leave')}>Leave room</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `src/components/JoinPrompt.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from './Toaster';
import { api } from '@/lib/api';

export function JoinPrompt({ code }: { code: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try { setName(localStorage.getItem('juan:name') ?? ''); } catch {}
  }, []);

  async function join() {
    if (!name.trim()) return toast('Enter a nickname first');
    try { localStorage.setItem('juan:name', name.trim()); } catch {}
    setBusy(true);
    try {
      await api('room/join', { code, name });
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <p className="text-white/70">You&apos;ve been invited to room</p>
      <p className="font-display text-5xl tracking-[0.3em] text-yellow-300">{code}</p>
      <div className="w-full max-w-sm space-y-3">
        <input className="input" placeholder="Your nickname" maxLength={16} value={name} autoFocus
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} />
        <button className="btn btn-green w-full" disabled={busy} onClick={join}>Join game</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write `src/app/room/[code]/page.tsx`** (`GameTable` is created in Task 12)

```tsx
'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GameTable } from '@/components/game/GameTable';
import { JoinPrompt } from '@/components/JoinPrompt';
import { Lobby } from '@/components/Lobby';
import { useRoom } from '@/lib/useRoom';
import { useUid } from '@/lib/useUid';
import { isRoomOpen } from '@/game/room';
import { normalizeRoomCode } from '@/game/roomCode';

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">{children}</main>;
}

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? '');
  const uid = useUid();
  const { room, hand, offline } = useRoom(code, uid);

  if (!uid || room === undefined) return <Centered><p className="animate-pulse font-display text-2xl">Shuffling…</p></Centered>;
  if (room === null) {
    return (
      <Centered>
        <p className="font-display text-3xl">Room not found</p>
        <Link href="/" className="btn btn-blue">Back home</Link>
      </Centered>
    );
  }

  const inGame = room.game?.players.some((p) => p.id === uid) ?? false;
  const inLobby = room.lobby.some((p) => p.id === uid);

  if (room.game && inGame) return <GameTable room={room} uid={uid} hand={hand} offline={offline} />;
  if (!inLobby) {
    if (!isRoomOpen(room)) {
      return (
        <Centered>
          <p className="font-display text-3xl">Game in progress</p>
          <p className="text-white/70">Wait for this round to end, then refresh to join.</p>
          <Link href="/" className="btn btn-blue">Back home</Link>
        </Centered>
      );
    }
    return <JoinPrompt code={code} />;
  }
  return <Lobby room={room} uid={uid} />;
}
```

- [ ] **Step 4: Commit** (the build passes after Task 12)

```bash
git add src && git commit -m "feat(ui): lobby, join prompt, room page"
```

---

### Task 12: Game table

**Files:**
- Create in `src/components/game/`: `layout.ts`, `sortHand.ts`, `TurnRing.tsx`, `Seat.tsx`, `CenterPile.tsx`, `Hand.tsx`, `ActionBar.tsx`, `ColorPicker.tsx`, `Effects.tsx`, `WinnerOverlay.tsx`, `GameTable.tsx`

- [ ] **Step 1: Write `src/components/game/layout.ts`**

```ts
export interface Pos { x: number; y: number } // percent of viewport

export const PILE_POS: Pos = { x: 50, y: 44 };
export const ME_POS: Pos = { x: 50, y: 90 };

/** Opponents spread on an arc from left, over the top, to right. */
export function seatPositions(count: number): Pos[] {
  return Array.from({ length: count }, (_, i) => {
    const t = Math.PI + (Math.PI * (i + 1)) / (count + 1);
    return { x: 50 + 41 * Math.cos(t), y: 34 + 23 * Math.sin(t) };
  });
}

/** Motion offset (in viewport units) from `to` back to `from`. */
export const offsetFrom = (from: Pos, to: Pos) => ({ x: `${from.x - to.x}vw`, y: `${from.y - to.y}vh` });
```

- [ ] **Step 2: Write `src/components/game/sortHand.ts`**

```ts
import type { Card } from '@/game/types';

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3 } as const;
const VALUE_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'];

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      (a.color ? COLOR_ORDER[a.color] : 4) - (b.color ? COLOR_ORDER[b.color] : 4) ||
      VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) ||
      a.id.localeCompare(b.id),
  );
}
```

- [ ] **Step 3: Write `src/components/game/TurnRing.tsx`**

```tsx
'use client';
import { useNow } from '@/lib/hooks';
import { TURN_MS } from '@/game/types';

export function TurnRing({ deadline, size, children }: { deadline: number; size: number; children: React.ReactNode }) {
  const now = useNow(200);
  const frac = Math.max(0, Math.min(1, (deadline - now) / TURN_MS));
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const color = frac > 0.5 ? '#4ade80' : frac > 0.2 ? '#facc15' : '#f87171';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.15)" strokeWidth={4} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} style={{ transition: 'stroke-dashoffset .2s linear, stroke .3s' }} />
      </svg>
      <div className="absolute inset-[5px] grid place-items-center">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/game/Seat.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { CardBack } from '../Card';
import { avatarColor } from '../Lobby';
import { TurnRing } from './TurnRing';
import type { Pos } from './layout';
import type { PlayerPublic } from '@/game/types';

interface Props {
  player: PlayerPublic;
  pos: Pos;
  isTurn: boolean;
  deadline: number;
  catchable: boolean;
  onCatch: () => void;
}

export function Seat({ player, pos, isTurn, deadline, catchable, onCatch }: Props) {
  const avatar = (
    <motion.div animate={{ scale: isTurn ? 1.08 : 1 }}
      className="grid h-11 w-11 place-items-center rounded-full font-display text-xl shadow-lg ring-2 ring-black/30"
      style={{ background: avatarColor(player.id), boxShadow: isTurn ? '0 0 24px rgba(250,204,21,.8)' : undefined }}>
      {player.name[0]?.toUpperCase()}
    </motion.div>
  );
  const fan = Math.min(player.cardCount, 6);
  return (
    <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      {isTurn ? <TurnRing deadline={deadline} size={58}>{avatar}</TurnRing> : <div className="p-[7px]">{avatar}</div>}
      <div className="max-w-[5.5rem] truncate rounded-full bg-black/55 px-2 text-xs font-bold">{player.name}</div>
      <div className="relative h-9 w-16">
        {Array.from({ length: fan }, (_, i) => (
          <div key={i} className="absolute left-1/2 top-0" style={{ transform: `translateX(${(i - (fan - 1) / 2) * 7 - 12}px) rotate(${(i - (fan - 1) / 2) * 8}deg)` }}>
            <CardBack size="xs" />
          </div>
        ))}
        <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 text-xs font-black text-black">{player.cardCount}</span>
      </div>
      {player.calledJuan && player.cardCount <= 2 && <span className="font-display text-xs text-yellow-300">JUAN!</span>}
      {catchable && (
        <motion.button onClick={onCatch} animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
          className="rounded-full bg-red-600 px-3 py-1 font-display text-sm shadow-lg">
          CATCH!
        </motion.button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/components/game/CenterPile.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CardBack, CardFace, COLOR_HEX, type CardSize } from '../Card';
import { offsetFrom, PILE_POS, type Pos } from './layout';
import type { Card, PublicState } from '@/game/types';

const tilt = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) % 997;
  return (h % 36) - 18;
};

interface Props {
  pub: PublicState;
  size: CardSize;
  enterFrom: Pos;
  canDraw: boolean;
  onDraw: () => void;
}

export function CenterPile({ pub, size, enterFrom, canDraw, onDraw }: Props) {
  const [pile, setPile] = useState<Card[]>([pub.topCard]);
  useEffect(() => {
    setPile((p) => (p[p.length - 1]?.id === pub.topCard.id ? p : [...p.slice(-4), pub.topCard]));
  }, [pub.topCard]);
  const glow = COLOR_HEX[pub.currentColor];

  return (
    <div className="absolute z-0 -translate-x-1/2 -translate-y-1/2" style={{ left: `${PILE_POS.x}%`, top: `${PILE_POS.y}%` }}>
      <motion.div key={pub.direction} className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 md:h-80 md:w-80"
        animate={{ rotate: pub.direction * 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 14 }}>
        <svg viewBox="0 0 100 100" className="h-full w-full opacity-40">
          <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="6 5" />
          {[0, 120, 240].map((a) => (
            <g key={a} transform={`rotate(${a} 50 50)`}>
              <path d={pub.direction === 1 ? 'M50 1 l5 3 -5 3z' : 'M50 1 l-5 3 5 3z'} fill="white" />
            </g>
          ))}
        </svg>
      </motion.div>

      <div className="relative flex items-center gap-6 md:gap-10">
        <button onClick={onDraw} disabled={!canDraw} className="relative" aria-label="Draw a card">
          {[2, 1, 0].map((i) => (
            <div key={i} className={i ? 'absolute' : 'relative'} style={{ top: -i * 3, left: -i * 2 }}>
              <CardBack size={size} />
            </div>
          ))}
          {canDraw && (
            <motion.div className="absolute -inset-2 rounded-2xl ring-4 ring-yellow-300/80" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} />
          )}
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/60">{pub.drawPileCount}</span>
        </button>

        <div className="relative">
          <motion.div className="absolute -inset-5 rounded-full blur-2xl" animate={{ backgroundColor: glow, opacity: 0.55 }} transition={{ duration: 0.4 }} />
          <div className="relative">
            <AnimatePresence initial={false}>
              {pile.map((card, i) => (
                <motion.div key={card.id} className={i === 0 ? 'relative' : 'absolute inset-0'}
                  initial={{ ...offsetFrom(enterFrom, PILE_POS), rotate: tilt(card.id) - 40, rotateY: 180, scale: 0.7 }}
                  animate={{ x: '0vw', y: '0vh', rotate: tilt(card.id), rotateY: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
                  <CardFace card={card} size={size} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {pub.pendingDraw && (
              <motion.div key="stack" initial={{ scale: 0 }} animate={{ scale: [1, 1.15, 1] }} exit={{ scale: 0 }}
                transition={{ scale: { repeat: Infinity, duration: 0.9 } }}
                className="absolute -right-6 -top-6 z-20 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-red-600 font-display text-xl shadow-xl ring-2 ring-white">
                +{pub.pendingDraw.count}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/components/game/Hand.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { CardFace, type CardSize } from '../Card';
import { sortHand } from './sortHand';
import type { Card } from '@/game/types';

interface Props {
  cards: Card[];
  legal: Set<string>;
  size: CardSize;
  width: number;
  shake: { id: string; n: number };
  onPlay: (card: Card) => void;
}

export function Hand({ cards, legal, size, width, shake, onPlay }: Props) {
  const sorted = useMemo(() => sortHand(cards), [cards]);
  const cardW = size === 'lg' ? 90 : 70;
  const n = sorted.length;
  const avail = Math.min(width - 24, 980);
  const step = n > 1 ? Math.min(cardW * 0.72, (avail - cardW) / (n - 1)) : 0;
  const spread = Math.min(6, 48 / Math.max(n, 1));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[28vh] min-h-[170px]">
      <AnimatePresence>
        {sorted.map((card, i) => {
          const off = i - (n - 1) / 2;
          const playable = legal.has(card.id);
          return (
            <motion.button key={card.id} layout onClick={() => onPlay(card)}
              className="pointer-events-auto absolute bottom-3 left-1/2"
              style={{ zIndex: i, marginLeft: -cardW / 2, transformOrigin: '50% 120%' }}
              initial={{ y: -320, opacity: 0, scale: 0.6 }}
              animate={{ x: off * step, y: off * off * 1.4 - (playable ? 22 : 0), rotate: off * spread, opacity: 1, scale: 1, filter: playable ? 'brightness(1)' : 'brightness(0.55)' }}
              exit={{ y: -280, opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
              whileHover={playable ? { y: -48, scale: 1.08 } : undefined}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
              <motion.div key={shake.id === card.id ? shake.n : 0} animate={shake.id === card.id ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.35 }}>
                <CardFace card={card} size={size} />
              </motion.div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/components/game/ActionBar.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { TurnRing } from './TurnRing';
import type { PublicState } from '@/game/types';

interface Props {
  pub: PublicState;
  uid: string;
  handCount: number;
  onDraw: () => void;
  onPass: () => void;
  onJuan: () => void;
}

export function ActionBar({ pub, uid, handCount, onDraw, onPass, onJuan }: Props) {
  const me = pub.players.find((p) => p.id === uid);
  const myTurn = pub.turnPlayerId === uid;
  const turnName = pub.players.find((p) => p.id === pub.turnPlayerId)?.name ?? '';
  let status = `${turnName}'s turn`;
  if (myTurn) {
    if (pub.pendingDraw) status = `+${pub.pendingDraw.count} on you! Stack a ${pub.pendingDraw.kind === 'draw2' ? '+2' : '+4'} or draw`;
    else if (pub.drawnCardId) status = 'Play the card you drew, or pass';
    else status = 'Your turn!';
  }
  const showJuan = (handCount === 2 && !me?.calledJuan) || pub.catchable === uid;

  return (
    <div className="absolute left-1/2 top-[61%] z-40 flex w-full -translate-x-1/2 flex-col items-center gap-2 px-2">
      <div className="flex items-center gap-2">
        {myTurn && <TurnRing deadline={pub.turnDeadline} size={34}><span className="text-[10px]">⏱</span></TurnRing>}
        <motion.span key={status} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className={`rounded-full px-4 py-1.5 text-center text-sm font-bold ${myTurn ? 'bg-yellow-300 text-black' : 'bg-black/55'}`}>
          {status}
        </motion.span>
      </div>
      <div className="flex gap-2">
        {myTurn && !pub.drawnCardId && (
          <button className="btn btn-blue px-4 py-2 text-base" onClick={onDraw}>
            {pub.pendingDraw ? `Draw ${pub.pendingDraw.count}` : 'Draw'}
          </button>
        )}
        {myTurn && pub.drawnCardId && <button className="btn btn-gray px-4 py-2 text-base" onClick={onPass}>Pass</button>}
        {showJuan && (
          <motion.button className="btn btn-red px-4 py-2 text-base" onClick={onJuan}
            animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
            JUAN!
          </motion.button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `src/components/game/ColorPicker.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { COLOR_HEX } from '../Card';
import { COLORS, type Color } from '@/game/types';

export function ColorPicker({ open, onPick, onCancel }: { open: boolean; onPick: (c: Color) => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}
            className="rounded-3xl bg-[#1c1030] p-6 text-center shadow-2xl ring-1 ring-white/10">
            <p className="mb-4 font-display text-2xl">Pick a colour</p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((c) => (
                <motion.button key={c} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => onPick(c)}
                  className="h-20 w-20 rounded-2xl shadow-lg ring-4 ring-white/20" style={{ background: COLOR_HEX[c] }} aria-label={c} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 9: Write `src/components/game/Effects.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CardBack } from '../Card';
import { PILE_POS, type Pos } from './layout';
import type { LastAction } from '@/game/types';

type Tone = 'gold' | 'red' | 'purple' | 'blue' | 'green' | 'gray';
const TONE: Record<Tone, string> = {
  gold: 'from-yellow-300 to-amber-500 text-black',
  red: 'from-red-500 to-rose-700',
  purple: 'from-fuchsia-500 to-violet-700',
  blue: 'from-sky-400 to-blue-700',
  green: 'from-emerald-400 to-green-700',
  gray: 'from-zinc-500 to-zinc-700',
};

function bannerFor(a: LastAction, nameOf: (id: string) => string): { text: string; tone: Tone } | null {
  if ((a.type === 'play' || a.type === 'jump') && a.penalty) return { text: "Can't finish on a power card! +1", tone: 'red' };
  switch (a.type) {
    case 'juan': return { text: `${nameOf(a.playerId)}: JUAN!`, tone: 'gold' };
    case 'catch': return { text: `${nameOf(a.targetId ?? '')} got caught! +2`, tone: 'red' };
    case 'jump': return { text: `${nameOf(a.playerId)} JUMPED IN!`, tone: 'purple' };
    case 'stackDraw': return { text: `${nameOf(a.playerId)} draws ${a.n}`, tone: 'red' };
    case 'timeout': return { text: `${nameOf(a.playerId)} ran out of time`, tone: 'gray' };
    case 'play':
      if (a.card?.value === 'wild4') return { text: '+4!', tone: 'red' };
      if (a.card?.value === 'draw2') return { text: '+2!', tone: 'red' };
      if (a.card?.value === 'skip') return { text: 'SKIP!', tone: 'blue' };
      if (a.card?.value === 'reverse') return { text: 'REVERSE!', tone: 'green' };
      return null;
    default: return null;
  }
}

function drawsFor(a: LastAction): { target: string; n: number } | null {
  if (a.type === 'catch') return { target: a.targetId ?? '', n: a.n ?? 0 };
  if (a.type === 'draw' || a.type === 'stackDraw' || a.type === 'timeout') return { target: a.playerId, n: a.n ?? 0 };
  if (a.penalty) return { target: a.playerId, n: 1 };
  return null;
}

export function Effects({ lastAction, nameOf, posOf }: { lastAction: LastAction; nameOf: (id: string) => string; posOf: (id: string) => Pos }) {
  const firstSeq = useRef(lastAction.seq);
  const [banner, setBanner] = useState<{ seq: number; text: string; tone: Tone } | null>(null);
  const [flyers, setFlyers] = useState<{ key: string; to: Pos; delay: number }[]>([]);

  useEffect(() => {
    if (lastAction.seq === firstSeq.current) return;
    const b = bannerFor(lastAction, nameOf);
    if (b) {
      setBanner({ seq: lastAction.seq, ...b });
      const seq = lastAction.seq;
      setTimeout(() => setBanner((cur) => (cur?.seq === seq ? null : cur)), 1400);
    }
    const d = drawsFor(lastAction);
    if (d && d.n > 0) {
      const to = posOf(d.target);
      setFlyers((f) => [...f, ...Array.from({ length: Math.min(d.n, 8) }, (_, i) => ({ key: `${lastAction.seq}-${i}`, to, delay: i * 0.08 }))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction.seq]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {flyers.map((f) => (
        <motion.div key={f.key} className="absolute -translate-x-1/2 -translate-y-1/2"
          initial={{ left: `${PILE_POS.x}%`, top: `${PILE_POS.y}%`, opacity: 1, scale: 1 }}
          animate={{ left: `${f.to.x}%`, top: `${f.to.y}%`, opacity: [1, 1, 0], scale: 0.6 }}
          transition={{ duration: 0.55, delay: f.delay, ease: 'easeInOut' }}
          onAnimationComplete={() => setFlyers((xs) => xs.filter((x) => x.key !== f.key))}>
          <CardBack size="sm" />
        </motion.div>
      ))}
      <AnimatePresence>
        {banner && (
          <motion.div key={banner.seq} className="absolute inset-x-0 top-[24%] flex justify-center"
            initial={{ scale: 0.3, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} exit={{ scale: 1.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
            <span className={`rounded-2xl bg-gradient-to-br px-6 py-3 font-display text-3xl shadow-2xl ring-4 ring-white/30 md:text-5xl ${TONE[banner.tone]}`}>
              {banner.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 10: Write `src/components/game/WinnerOverlay.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { COLOR_HEX } from '../Card';
import { COLORS } from '@/game/types';

interface Props {
  winnerName: string;
  isMe: boolean;
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function WinnerOverlay({ winnerName, isMe, isHost, busy, onPlayAgain, onLeave }: Props) {
  const confetti = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 1.5, dur: 2.5 + Math.random() * 2,
      color: COLOR_HEX[COLORS[i % 4]], rot: Math.random() * 720 - 360,
    })),
    [],
  );
  return (
    <motion.div className="fixed inset-0 z-[85] grid place-items-center overflow-hidden bg-black/70 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {confetti.map((c, i) => (
        <motion.div key={i} className="absolute top-0 h-3 w-2 rounded-sm" style={{ left: `${c.left}%`, background: c.color }}
          initial={{ y: '-5vh', rotate: 0 }} animate={{ y: '110vh', rotate: c.rot }}
          transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }} />
      ))}
      <motion.div initial={{ scale: 0.5, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="relative w-full max-w-sm rounded-3xl bg-[#1c1030] p-8 text-center shadow-2xl ring-1 ring-white/10">
        <div className="text-6xl">🏆</div>
        <h2 className="mt-2 font-display text-4xl text-yellow-300">{isMe ? 'You win!' : `${winnerName} wins!`}</h2>
        <div className="mt-6 space-y-3">
          {isHost ? (
            <button className="btn btn-green w-full" disabled={busy} onClick={onPlayAgain}>Play again</button>
          ) : (
            <p className="text-white/70">Waiting for the host to start a new game…</p>
          )}
          <button className="w-full py-2 text-sm text-white/60 hover:text-white" onClick={onLeave}>Leave room</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 11: Write `src/components/game/GameTable.tsx`**

```tsx
'use client';
import { motion, useAnimationControls } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RulesButton } from '../RulesButton';
import { toast } from '../Toaster';
import { ActionBar } from './ActionBar';
import { CenterPile } from './CenterPile';
import { ColorPicker } from './ColorPicker';
import { Effects } from './Effects';
import { Hand } from './Hand';
import { ME_POS, PILE_POS, seatPositions, type Pos } from './layout';
import { Seat } from './Seat';
import { WinnerOverlay } from './WinnerOverlay';
import { api, sendAction } from '@/lib/api';
import { useNow, useViewport } from '@/lib/hooks';
import { explainIllegal, isWild, legalCardIds } from '@/game/rules';
import type { RoomDoc } from '@/game/room';
import type { Action, Card, Color } from '@/game/types';

interface Props {
  room: RoomDoc;
  uid: string;
  hand: Card[];
  offline: boolean;
}

export function GameTable({ room, uid, hand, offline }: Props) {
  const router = useRouter();
  const pub = room.game!;
  const code = room.code;
  const { width } = useViewport();
  const size = width >= 768 ? 'lg' : 'md';

  const n = pub.players.length;
  const myIdx = Math.max(0, pub.players.findIndex((p) => p.id === uid));
  const opponents = useMemo(() => Array.from({ length: n - 1 }, (_, k) => pub.players[(myIdx + k + 1) % n]), [pub.players, myIdx, n]);
  const seats = useMemo(() => seatPositions(opponents.length), [opponents.length]);

  const posOf = useCallback(
    (id: string): Pos => (id === uid ? ME_POS : seats[opponents.findIndex((o) => o.id === id)] ?? PILE_POS),
    [uid, seats, opponents],
  );
  const nameOf = useCallback((id: string) => pub.players.find((p) => p.id === id)?.name ?? '?', [pub.players]);

  const legal = useMemo(() => legalCardIds(pub, uid, hand), [pub, uid, hand]);
  const [wildCard, setWildCard] = useState<Card | null>(null);
  const [shake, setShake] = useState({ id: '', n: 0 });
  const [busy, setBusy] = useState(false);
  const shakeTable = useAnimationControls();

  const run = useCallback(async (action: Action, cardId?: string) => {
    try {
      await sendAction(code, action);
    } catch (e) {
      toast((e as Error).message);
      if (cardId) setShake((s) => ({ id: cardId, n: s.n + 1 }));
    }
  }, [code]);

  function onPlay(card: Card) {
    if (!legal.has(card.id)) {
      setShake((s) => ({ id: card.id, n: s.n + 1 }));
      toast(explainIllegal(pub, uid, card));
      return;
    }
    if (isWild(card)) return setWildCard(card);
    run({ type: 'play', cardId: card.id }, card.id);
  }

  function onPickColor(color: Color) {
    if (!wildCard) return;
    run({ type: 'play', cardId: wildCard.id, chosenColor: color }, wildCard.id);
    setWildCard(null);
  }

  // Any client nudges the server when the current turn's deadline has passed.
  const now = useNow(1000);
  const timeoutSentFor = useRef(0);
  useEffect(() => {
    if (pub.status !== 'playing' || now < pub.turnDeadline + 1500 || timeoutSentFor.current === pub.turnDeadline) return;
    timeoutSentFor.current = pub.turnDeadline;
    sendAction(code, { type: 'timeout' }).catch(() => { timeoutSentFor.current = 0; });
  }, [now, pub.turnDeadline, pub.status, code]);

  // Shake the table when a +4 lands.
  const firstSeq = useRef(pub.lastAction.seq);
  useEffect(() => {
    const a = pub.lastAction;
    if (a.seq !== firstSeq.current && (a.type === 'play' || a.type === 'jump') && a.card?.value === 'wild4') {
      shakeTable.start({ x: [0, -14, 14, -10, 10, -4, 0], transition: { duration: 0.5 } });
    }
  }, [pub.lastAction, shakeTable]);

  const la = pub.lastAction;
  const enterFrom = (la.type === 'play' || la.type === 'jump') && la.card?.id === pub.topCard.id ? posOf(la.playerId) : PILE_POS;
  const myTurn = pub.turnPlayerId === uid;

  async function playAgain() {
    setBusy(true);
    try { await api('room/start', { code }); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  async function leave() {
    await api('room/leave', { code }).catch(() => {});
    router.push('/');
  }

  return (
    <motion.main animate={shakeTable} className="fixed inset-0 select-none overflow-hidden">
      <div className="felt-wrap"><div className="felt" /></div>

      <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between p-3">
        <span className="rounded-full bg-black/50 px-3 py-1 font-display tracking-widest text-yellow-300">{code}</span>
        <RulesButton />
      </div>
      {offline && (
        <div className="absolute inset-x-0 top-14 z-50 mx-auto w-fit rounded-full bg-red-600 px-4 py-1 text-sm font-bold">Reconnecting…</div>
      )}

      {opponents.map((p, i) => (
        <Seat key={p.id} player={p} pos={seats[i]} isTurn={pub.turnPlayerId === p.id} deadline={pub.turnDeadline}
          catchable={pub.catchable === p.id} onCatch={() => run({ type: 'catch', targetId: p.id })} />
      ))}

      <CenterPile pub={pub} size={size} enterFrom={enterFrom} canDraw={myTurn && !pub.drawnCardId}
        onDraw={() => run({ type: 'draw' })} />

      <ActionBar pub={pub} uid={uid} handCount={hand.length}
        onDraw={() => run({ type: 'draw' })} onPass={() => run({ type: 'pass' })} onJuan={() => run({ type: 'callJuan' })} />

      <Hand cards={hand} legal={legal} size={size} width={width} shake={shake} onPlay={onPlay} />

      <Effects lastAction={pub.lastAction} nameOf={nameOf} posOf={posOf} />
      <ColorPicker open={!!wildCard} onPick={onPickColor} onCancel={() => setWildCard(null)} />
      {pub.status === 'finished' && (
        <WinnerOverlay winnerName={nameOf(pub.winnerId ?? '')} isMe={pub.winnerId === uid} isHost={room.hostId === uid}
          busy={busy} onPlayAgain={playAgain} onLeave={leave} />
      )}
    </motion.main>
  );
}
```

- [ ] **Step 12: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 13: Commit**

```bash
git add src && git commit -m "feat(ui): 2.5D game table with animations"
```

---

### Task 13: Create the GitHub repo and push

- [ ] **Step 1: Create the public repo and push**

```bash
cd /Users/viggy/Juan && gh repo create vignesh2k/juan --public --source . --push --description "Juan — an Uno-style online card game for friends"
```

Expected: the repo URL is printed and `main` is pushed.

---

### Task 14: Firebase project setup (via the user's Chrome; confirm each step with the user)

- [ ] **Step 1:** At console.firebase.google.com, create project `juan-netgames` (or the nearest available ID). Disable Google Analytics.
- [ ] **Step 2:** Build → Authentication → Get started → Sign-in method → enable **Anonymous**.
- [ ] **Step 3:** Build → Firestore Database → Create database → location `europe-west2` (London), production mode.
- [ ] **Step 4:** Firestore → Rules → paste the contents of `firestore.rules` → Publish.
- [ ] **Step 5:** Project settings → General → Add app → Web (nickname `juan-web`, no hosting). Copy the `firebaseConfig` values into `src/lib/firebaseConfig.ts`. If the project ID differs from `juan-netgames`, use the real one everywhere.
- [ ] **Step 6:** Project settings → Service accounts → Generate new private key. **Ask the user before downloading.** The file lands in `~/Downloads`.
- [ ] **Step 7:** Create `.env.local` (gitignored) from the downloaded key:

```bash
KEY=$(ls -t ~/Downloads/*firebase-adminsdk*.json | head -1)
printf 'FIREBASE_SERVICE_ACCOUNT_B64=%s\n' "$(base64 -i "$KEY" | tr -d '\n')" > /Users/viggy/Juan/.env.local
```

- [ ] **Step 8:** Commit the config.

```bash
git add src/lib/firebaseConfig.ts && git commit -m "chore: firebase web config" && git push
```

---

### Task 15: Local end-to-end test

- [ ] **Step 1:** Add `.claude/launch.json` with a `dev` configuration (`npm run dev`, port 3000). Start it with `preview_start`.
- [ ] **Step 2:** Tab 1: `http://localhost:3000/?fresh`, nickname "Ana", Create room. Note the code.
- [ ] **Step 3:** Tab 2: `http://localhost:3000/?fresh`, nickname "Ben", Join with the code. Confirm both appear in the lobby.
- [ ] **Step 4:** Start the game as host. In each tab, verify:
  - 7 cards are shown and opponent counts are correct.
  - Playable cards are highlighted.
  - Playing a card animates it onto the pile and passes the turn.
  - Draw works.
  - The rules modal opens.
  - Out-of-turn plays show a toast.
- [ ] **Step 5:** Wait more than 30s on a turn and verify the auto-draw timeout fires.
- [ ] **Step 6:** Check the browser console and server logs for errors. Fix any found, re-run tests, and commit.

---

### Task 16: Vercel deployment

- [ ] **Step 1:** Ask the user to run `npx vercel@latest login` in a terminal tab and complete the browser login.
- [ ] **Step 2:** Link and configure the project.

```bash
cd /Users/viggy/Juan && npx vercel@latest link --yes --project juan
for env in production preview development; do grep '^FIREBASE_SERVICE_ACCOUNT_B64=' .env.local | cut -d= -f2- | npx vercel@latest env add FIREBASE_SERVICE_ACCOUNT_B64 $env; done
npx vercel@latest git connect https://github.com/vignesh2k/juan --yes
```

If `git connect` needs the Vercel GitHub app, complete that in the user's Chrome with their approval.

- [ ] **Step 3:** Deploy to production.

```bash
npx vercel@latest --prod
```

Expected: a `https://juan-*.vercel.app` URL. Open it and verify the home page loads and Create room works.

---

### Task 17: Custom domain on Cloudflare

- [ ] **Step 1:** Add the domain to the project.

```bash
npx vercel@latest domains add juan.netgames.uk
npx vercel@latest domains inspect juan.netgames.uk
```

Note the CNAME target Vercel asks for (e.g. `cname.vercel-dns.com` or a project-specific `*.vercel-dns-*.com`).

- [ ] **Step 2:** In the user's Chrome, go to dash.cloudflare.com → netgames.uk → DNS → Records → Add record:
  - Type `CNAME`, Name `juan`, Target from Step 1.
  - Proxy status **DNS only** (grey cloud).
  - Confirm with the user before saving.
- [ ] **Step 3:** Wait for verification.

```bash
npx vercel@latest domains inspect juan.netgames.uk
dig +short juan.netgames.uk CNAME
```

Expected: the CNAME resolves and Vercel shows the domain as valid, with SSL issued.

- [ ] **Step 4:** Firebase Auth → Settings → Authorized domains → add `juan.netgames.uk` (and the `*.vercel.app` production domain).
- [ ] **Step 5:** Open `https://juan.netgames.uk`, create a room in one tab and join from a `?fresh` tab, then play a few turns. Confirm it works.
