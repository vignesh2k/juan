import { isPower, isWild, legalCardIds } from './rules';
import { COLORS, type Action, type Color, type GameState } from './types';

/** Pick a legal, deliberately simple move using only this bot's hand. */
export function botAction(state: GameState, id: string): Action {
  const hand = state.priv.hands[id];
  const legal = hand.filter((card) => legalCardIds(state.pub, id, hand).has(card.id));
  const player = state.pub.players.find((p) => p.id === id)!;
  if (hand.length === 2 && legal.length && !player.calledJuan) return { type: 'callJuan' };
  if (!legal.length) return state.pub.drawnCardId ? { type: 'pass' } : { type: 'draw' };
  // Save wilds when possible and avoid a power card as the last card.
  const card = [...legal].sort((a, b) =>
    (Number(isWild(a)) * 2 + Number(hand.length === 1 && isPower(a))) -
    (Number(isWild(b)) * 2 + Number(hand.length === 1 && isPower(b)))
  )[0];
  if (!isWild(card)) return { type: 'play', cardId: card.id };
  const counts = Object.fromEntries(COLORS.map((color) => [color, hand.filter((c) => c.id !== card.id && c.color === color).length])) as Record<Color, number>;
  const chosenColor = COLORS.reduce((best, color) => counts[color] > counts[best] ? color : best, state.pub.currentColor);
  return { type: 'play', cardId: card.id, chosenColor };
}
