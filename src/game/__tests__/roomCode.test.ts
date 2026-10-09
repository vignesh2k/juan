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
