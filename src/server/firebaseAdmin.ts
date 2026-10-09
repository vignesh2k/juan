import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not set');
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  return initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  });
}

let db: Firestore | null = null;

export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(adminApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export const adminAuth = () => getAuth(adminApp());
