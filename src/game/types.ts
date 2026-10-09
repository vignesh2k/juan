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
