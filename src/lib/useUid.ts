'use client';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { clientAuth } from './firebaseClient';
import { toast } from '@/components/Toaster';

export function useUid(): string | null {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const auth = clientAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else {
        signInAnonymously(auth).catch((e) => {
          console.error('anonymous sign-in failed', e);
          toast('Could not connect — check your connection and refresh');
        });
      }
    });
  }, []);
  return uid;
}
