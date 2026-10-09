import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const app = (): FirebaseApp => getApps()[0] ?? initializeApp(firebaseConfig);

function freshTab(): boolean {
  try {
    if (new URLSearchParams(location.search).has('fresh')) sessionStorage.setItem('juan:fresh', '1');
    return sessionStorage.getItem('juan:fresh') === '1';
  } catch {
    return false;
  }
}

let auth: Auth | null = null;
export function clientAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(app(), {
      persistence: freshTab() ? browserSessionPersistence : [indexedDBLocalPersistence, browserLocalPersistence],
    });
  }
  return auth;
}

export const clientDb = (): Firestore => getFirestore(app());
