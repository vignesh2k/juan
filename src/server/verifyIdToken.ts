import { createRemoteJWKSet, jwtVerify } from 'jose';
import { firebaseConfig } from '@/lib/firebaseConfig';

// Verified with jose directly rather than firebase-admin/auth, whose jwks-rsa
// dependency fails to load (require of ESM) in the Vercel function runtime.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** Verifies a Firebase Auth ID token and returns the user's uid. Throws if invalid. */
export async function verifyIdToken(token: string): Promise<string> {
  const projectId = firebaseConfig.projectId;
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Token has no subject');
  if (typeof payload.auth_time === 'number' && payload.auth_time * 1000 > Date.now() + 60_000) {
    throw new Error('Token auth_time is in the future');
  }
  return payload.sub;
}
