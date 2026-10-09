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
      return Response.json({ ok: true, ...data, serverNow: Date.now() });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ ok: false, error: e.message, serverNow: Date.now() }, { status: e.status });
      console.error(e);
      return Response.json({ ok: false, error: 'Something went wrong', serverNow: Date.now() }, { status: 500 });
    }
  };
}
