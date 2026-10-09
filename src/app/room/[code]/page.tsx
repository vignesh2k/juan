'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GameTable } from '@/components/game/GameTable';
import { JoinPrompt } from '@/components/JoinPrompt';
import { Lobby } from '@/components/Lobby';
import { useRoom } from '@/lib/useRoom';
import { useUid } from '@/lib/useUid';
import { isRoomOpen } from '@/game/room';
import { normalizeRoomCode } from '@/game/roomCode';

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">{children}</main>;
}

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? '');
  const uid = useUid();
  const { room, hand, offline } = useRoom(code, uid);

  if (!uid || room === undefined) return <Centered><p className="animate-pulse font-display text-2xl">Shuffling…</p></Centered>;
  if (room === null) {
    return (
      <Centered>
        <p className="font-display text-3xl">Room not found</p>
        <Link href="/" className="btn btn-blue">Back home</Link>
      </Centered>
    );
  }

  const inGame = room.game?.players.some((p) => p.id === uid) ?? false;
  const inLobby = room.lobby.some((p) => p.id === uid);

  if (room.game && inGame) return <GameTable room={room} uid={uid} hand={hand} offline={offline} />;
  if (!inLobby) {
    if (!isRoomOpen(room)) {
      return (
        <Centered>
          <p className="font-display text-3xl">Game in progress</p>
          <p className="text-white/70">Wait for this round to end, then refresh to join.</p>
          <Link href="/" className="btn btn-blue">Back home</Link>
        </Centered>
      );
    }
    return <JoinPrompt code={code} />;
  }
  return <Lobby room={room} uid={uid} />;
}
