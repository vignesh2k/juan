'use client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { clientDb } from './firebaseClient';
import type { RoomDoc } from '@/game/room';
import { isValidRoomCode } from '@/game/roomCode';
import type { Card } from '@/game/types';

/** room: undefined = loading, null = not found. Does not subscribe for an invalid code. */
export function useRoom(code: string, uid: string | null) {
  const valid = isValidRoomCode(code);
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  const [hand, setHand] = useState<Card[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!uid || !valid) return;
    return onSnapshot(
      doc(clientDb(), 'rooms', code),
      { includeMetadataChanges: true },
      (snap) => {
        setOffline(snap.metadata.fromCache);
        setRoom(snap.exists() ? (snap.data() as RoomDoc) : snap.metadata.fromCache ? undefined : null);
      },
      () => setRoom(null),
    );
  }, [code, uid, valid]);

  useEffect(() => {
    if (!uid || !valid) return;
    return onSnapshot(
      doc(clientDb(), 'rooms', code, 'hands', uid),
      (snap) => setHand((snap.data()?.cards as Card[] | undefined) ?? []),
      () => setHand([]),
    );
  }, [code, uid, valid]);

  return { room, hand, offline };
}
