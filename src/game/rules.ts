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
