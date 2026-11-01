import { describe, expect, it, vi } from 'vitest';
vi.mock('./verifyIdToken', () => ({ verifyIdToken: vi.fn() }));
import { readJsonObject } from './http';

const request = (body: BodyInit, headers?: HeadersInit) => new Request('https://example.test', { method: 'POST', body, headers });
describe('API request limits', () => {
  it('accepts normal JSON objects', async () => {
    await expect(readJsonObject(request(JSON.stringify({ code: 'ABCDE' })))).resolves.toEqual({ code: 'ABCDE' });
  });
  it('rejects oversized streams even with a false length', async () => {
    await expect(readJsonObject(request(JSON.stringify({ text: 'x'.repeat(33000) }), { 'content-length': '1' }))).rejects.toMatchObject({ status: 413 });
  });
  it('rejects malformed and non-object JSON', async () => {
    for (const body of ['{', 'null', '[]']) await expect(readJsonObject(request(body))).rejects.toMatchObject({ status: 400 });
  });
});
