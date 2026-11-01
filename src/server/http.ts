import { verifyIdToken } from './verifyIdToken';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireUid(req: Request): Promise<string> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Not signed in');
  try {
    return await verifyIdToken(header.slice(7));
  } catch {
    throw new HttpError(401, 'Not signed in');
  }
}

type Body = Record<string, unknown>;

export function handler(fn: (uid: string, body: Body) => Promise<object | void>) {
  return async (req: Request) => {
    try {
      const uid = await requireUid(req);
      const body = await readJsonObject(req);
      const data = (await fn(uid, body)) ?? {};
      return Response.json({ ok: true, ...data, serverNow: Date.now() });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ ok: false, error: e.message, serverNow: Date.now() }, { status: e.status });
      console.error(e);
      return Response.json({ ok: false, error: 'Something went wrong', serverNow: Date.now() }, { status: 500 });
    }
  };
}

// Bound the actual stream, including requests without a trustworthy Content-Length.
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const limit = 32 * 1024;
  const length = req.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new HttpError(413, 'Request too large');
  if (!req.body) throw new HttpError(400, 'Invalid request');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'Invalid request'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid request');
  return value as Record<string, unknown>;
}
