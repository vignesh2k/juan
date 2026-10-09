import { clientAuth } from './firebaseClient';
import { setOffsetFromResponse } from './serverClock';
import type { Action } from '@/game/types';

const TIMEOUT_MS = 10_000;
const NETWORK_ERROR = 'Network error — check your connection';

export async function api<T extends object = object>(path: string, body: object): Promise<T> {
  const user = clientAuth().currentUser;
  if (!user) throw new Error('Still connecting… try again in a second');
  const token = await user.getIdToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const sentAt = Date.now();
  let data;
  try {
    const res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const receivedAt = Date.now();
    data = await res.json().catch(() => ({ ok: false, error: ctrl.signal.aborted ? NETWORK_ERROR : 'Network error' }));
    setOffsetFromResponse(data.serverNow, sentAt, receivedAt);
  } catch {
    throw new Error(NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
  }
  if (!data.ok) throw new Error(data.error ?? 'Something went wrong');
  return data as T;
}

export const sendAction = (code: string, action: Action) => api('room/action', { code, action });
