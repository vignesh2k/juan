'use client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { clientDb } from './firebaseClient';
import type { RoomDoc } from '@/game/room';
import type { Card } from '@/game/types';

/** room: undefined = loading, null = not found */
export function useRoom(code: string, uid: string | null) {
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  const [hand, setHand] = useState<Card[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(clientDb(), 'rooms', code),
      { includeMetadataChanges: true },
      (snap) => {
        setOffline(snap.metadata.fromCache);
        setRoom(snap.exists() ? (snap.data() as RoomDoc) : snap.metadata.fromCache ? undefined : null);
      },
      () => setRoom(null),
    );
  }, [code, uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(clientDb(), 'rooms', code, 'hands', uid),
      (snap) => setHand((snap.data()?.cards as Card[] | undefined) ?? []),
      () => setHand([]),
    );
  }, [code, uid]);

  return { room, hand, offline };
}
