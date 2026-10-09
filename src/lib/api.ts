import { clientAuth } from './firebaseClient';
import { setOffsetFromResponse } from './serverClock';
import type { Action } from '@/game/types';

export async function api<T extends object = object>(path: string, body: object): Promise<T> {
  const user = clientAuth().currentUser;
  if (!user) throw new Error('Still connecting… try again in a second');
  const token = await user.getIdToken();
  const sentAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error — check your connection');
  }
  const receivedAt = Date.now();
  const data = await res.json().catch(() => ({ ok: false, error: 'Network error' }));
  setOffsetFromResponse(data.serverNow, sentAt, receivedAt);
  if (!data.ok) throw new Error(data.error ?? 'Something went wrong');
  return data as T;
}

export const sendAction = (code: string, action: Action) => api('room/action', { code, action });
