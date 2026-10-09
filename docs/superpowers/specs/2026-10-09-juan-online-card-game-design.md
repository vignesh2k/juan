# Juan — Online Multiplayer Card Game (Design)

Date: 2026-10-09
Status: Approved

## Goal

A browser game ("Juan", an Uno-like) that friends play together online. One player creates a room and shares a 5-character code; others join with the code. Hosted at `juan.netgames.uk`.

## Stack & Hosting

- **Frontend + API:** Next.js (App Router, TypeScript), Tailwind CSS, Framer Motion. Hosted on Vercel.
- **Realtime state:** Firebase Firestore (client SDK listeners for live updates).
- **Identity:** Firebase Anonymous Auth + a nickname. The anonymous uid persists in the browser, so reloading rejoins the same seat. No accounts.
- **Authority:** Vercel API routes using the Firebase Admin SDK are the only writers of game state. Clients never write game documents directly. This stays on the free Firebase Spark plan (no Cloud Functions).
- **Domain:** Cloudflare DNS `CNAME juan → cname.vercel-dns.com`, **DNS only (proxy off)**, added as a custom domain on the Vercel project.
- **Repo:** `github.com/vignesh2k/juan` (public).

## Units

### 1. Rules engine (`src/game/`)
Pure TypeScript with no I/O. It exports:
- `createDeck()` / `shuffle(deck, rng)`: standard 108-card deck. Per colour (red, yellow, green, blue): one 0, two each of 1–9, two Skip, two Reverse, two +2. Plus 4 Wild and 4 Wild +4.
- `startGame(players, rng)`: deals 7 each and flips a starting card (redrawn until it is a number card). Picks a random first player.
- `applyAction(state, playerId, action, now, rng) → { state } | { error }`, where `action` is one of `play {cardId, chosenColor?}`, `draw`, `pass`, `callJuan`, `catch {targetId}` or `timeout`.
- `legalPlays(state, playerId)`: used by the UI to highlight cards.

State is split into **public** (visible to everyone) and **private** (hands, draw pile). The engine works on the full state; the server splits it when persisting.

Fully unit-tested with Vitest.

### 2. Game server (`src/app/api/*`)
Routes: `POST /api/room/create`, `/api/room/join`, `/api/room/start`, `/api/room/action`, `/api/room/rematch`.

Each route:
1. Verifies the Firebase ID token in the `Authorization: Bearer` header.
2. Runs a Firestore transaction: read room + hands + deck, call the engine, write the results back.
3. Returns `{ok}` or `{error}` (HTTP 400 with a human-readable message).

Transactions serialise concurrent actions, so the first valid jump-in wins and later conflicting ones fail cleanly.

### 3. Firestore layout
- `rooms/{CODE}`: public state. Contains `status` (lobby | playing | finished), `hostId`, `players[] {id, name, cardCount, calledJuan}`, `turnPlayerId`, `direction`, `topCard`, `currentColor`, `pendingDraw {kind: '+2'|'+4', count} | null`, `turnDeadline` (ms epoch), `drawCount` (current player has drawn this turn), `catchable {playerId} | null`, `drawPileCount`, `lastAction {type, playerId, card?, n?, seq}`, `winnerId`, `updatedAt`.
- `rooms/{CODE}/hands/{uid}`: `{cards: Card[]}`.
- `rooms/{CODE}/secret/deck`: `{drawPile: Card[], discard: Card[]}`.

Security rules:
- The room doc is readable by any signed-in user.
- A hand is readable only by its owner (`request.auth.uid == uid`).
- The `secret` subcollection is not readable by clients.
- All client writes are denied.

### 4. Client UI (`src/app`, `src/components`)
Screens:
- **Home:** nickname plus Create Room / Join Room (code input).
- **Lobby:** big code with a copy button, player list, Start button (host only, needs 2+ players).
- **Game.**
- **Winner overlay:** shows the winner, with Rematch for the host and Leave for everyone.

The client subscribes to the room doc and its own hand doc. It sends actions to the API and never mutates state optimistically, apart from animations.

## Rules (authoritative)

1. **Matching:** a card is playable on the top card if it matches `currentColor`, matches number/symbol, or is a Wild.
2. **+4 any time:** a Wild +4 is playable on anything except while a `+2` stack is pending. The player picks a colour.
3. **Stacking:** while `pendingDraw` is set, the current player may only play a card of the same draw kind: +2 on a +2 stack (any colour), +4 on a +4 stack. Each card adds 2 or 4. Mixing +2 and +4 is never allowed. Otherwise the player must `draw`, which takes the whole `pendingDraw.count`, clears the stack and ends their turn.
4. **Jump-in:** any player, even out of turn, may play a card identical to the top card (same colour *and* same number/symbol). Wild and +4 count as identical to the same wild type, and a jumped Wild/+4 picks a new colour. Turn order then continues from the jumper, so everyone between is skipped. The jumped card's own effect applies as normal: Skip skips the next player after the jumper, Reverse reverses from the jumper, and +2/+4 adds to or creates the stack. A jump-in onto a pending stack adds to the stack and passes it on from the jumper. The current player can't "jump in" on their own turn; that's just a normal play.
5. **Drawing:** on your turn (no stack pending) you may draw 1. If that card is playable you may play it immediately or `pass`. If not, your turn passes automatically. Only the drawn card may be played after a draw.
6. **Action cards:** Skip skips the next player. Reverse flips direction, and with 2 players it acts as a Skip. +2 and +4 start or extend the stack aimed at the next player.
7. **Juan call:** `callJuan` is available when you hold 2 cards (whether or not it is your turn), and it sets `calledJuan`. If a player goes down to 1 card without having called, they become `catchable`. Any other player may `catch` them until the next action is taken, and the caught player draws 2. `calledJuan` resets whenever their card count goes above 1.
8. **Ending on a power card:** if a player plays their last card and it is a power card (Skip, Reverse, +2, Wild, +4), the card takes effect and the player then draws 1 penalty card, so they are not out.
9. **Winning:** the first player to reach 0 cards by playing a number card wins. Status becomes `finished`. There is no scoring.
10. **Turn timer:** 30 seconds per turn. When `now > turnDeadline`, any client may send `timeout`. The server re-checks the deadline, then auto-draws for the stalled player (the stack total if one is pending, else 1) and passes their turn.
11. **Deck exhaustion:** when the draw pile is empty, the discard pile minus the top card is reshuffled into it. If no cards remain at all, the player draws as many as are available.
12. **Rooms:** 2–8 players. Join only while in the lobby. Codes are 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes O/0/I/1). Rooms idle for over 24 hours are treated as expired and their codes can be reused.

## Visual Design

- A 2.5D table: a CSS-perspective tilted felt surface with soft lighting and a vignette.
- **Opponents:** placed around an ellipse with avatar initials, a card-back fan and a count badge. The current turn glows, and a countdown ring shows the timer.
- **Centre:** the draw pile (3D stacked backs), the discard pile with a slight random rotation per card, and the current-colour glow ring. A direction ring animates clockwise or anticlockwise. A stack badge ("+6") pulses.
- **Your hand:** a fanned arc at the bottom. Playable cards lift and glow, and unplayable ones dim. Tap or click to play. A colour picker modal appears for wilds.
- **Animations (Framer Motion):** card flies from the player's position to the discard pile with a 3D flip, draws fly from the pile to the hand or opponent, the room shakes when a +4 lands, a "JUAN!" banner pops, and a confetti-style winner overlay ends the game.
- Responsive layouts for portrait phones and desktop.
- A "?" button opens a modal listing all the rules above in plain language.

## Error Handling

- API errors are shown as a toast, and the selected card shakes.
- Firestore disconnects show a "Reconnecting…" banner, and the listeners resume automatically.
- Joining a room that is missing, full or already started returns a clear message.
- If the host leaves the lobby, host passes to the next player.

## Testing

- Vitest unit tests for the rules engine. They cover every rule above, including stacking, illegal mixing, jump-in skipping and stack propagation, Juan catch, power-card ending, timeout, reshuffle and the 2-player reverse.
- Manual end-to-end play in two browser tabs in the browser pane.
- `next build` must pass before deploying.

## Out of Scope

Scoring, accounts, chat, spectators, house-rule toggles, bots.
