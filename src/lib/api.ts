import { clientAuth } from './firebaseClient';
import type { Action } from '@/game/types';

export async function api<T extends object = object>(path: string, body: object): Promise<T> {
  const user = clientAuth().currentUser;
  if (!user) throw new Error('Still connecting… try again in a second');
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Network error' }));
  if (!data.ok) throw new Error(data.error ?? 'Something went wrong');
  return data as T;
}

export const sendAction = (code: string, action: Action) => api('room/action', { code, action });
