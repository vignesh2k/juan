'use client';
import { motion, useAnimationControls } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RulesButton } from '../RulesButton';
import { toast } from '../Toaster';
import { ActionBar } from './ActionBar';
import { CenterPile } from './CenterPile';
import { ColorPicker } from './ColorPicker';
import { Effects } from './Effects';
import { Hand } from './Hand';
import { ME_POS, PILE_POS, seatPositions, type Pos } from './layout';
import { Seat } from './Seat';
import { WinnerOverlay } from './WinnerOverlay';
import { api, sendAction } from '@/lib/api';
import { useNow, useViewport } from '@/lib/hooks';
import { explainIllegal, isWild, legalCardIds } from '@/game/rules';
import type { RoomDoc } from '@/game/room';
import type { Action, Card, Color } from '@/game/types';

interface Props {
  room: RoomDoc;
  uid: string;
  hand: Card[];
  offline: boolean;
}

export function GameTable({ room, uid, hand, offline }: Props) {
  const router = useRouter();
  const pub = room.game!;
  const code = room.code;
  const { width } = useViewport();
  const size = width >= 768 ? 'lg' : 'md';

  const n = pub.players.length;
  const myIdx = Math.max(0, pub.players.findIndex((p) => p.id === uid));
  const opponents = useMemo(() => Array.from({ length: n - 1 }, (_, k) => pub.players[(myIdx + k + 1) % n]), [pub.players, myIdx, n]);
  const seats = useMemo(() => seatPositions(opponents.length), [opponents.length]);

  const posOf = useCallback(
    (id: string): Pos => (id === uid ? ME_POS : seats[opponents.findIndex((o) => o.id === id)] ?? PILE_POS),
    [uid, seats, opponents],
  );
  const nameOf = useCallback((id: string) => pub.players.find((p) => p.id === id)?.name ?? '?', [pub.players]);

  const legal = useMemo(() => legalCardIds(pub, uid, hand), [pub, uid, hand]);
  const [wildCard, setWildCard] = useState<Card | null>(null);
  const [shake, setShake] = useState({ id: '', n: 0 });
  const [busy, setBusy] = useState(false);
  const shakeTable = useAnimationControls();

  const run = useCallback(async (action: Action, cardId?: string) => {
    try {
      await sendAction(code, action);
    } catch (e) {
      toast((e as Error).message);
      if (cardId) setShake((s) => ({ id: cardId, n: s.n + 1 }));
    }
  }, [code]);

  function onPlay(card: Card) {
    if (!legal.has(card.id)) {
      setShake((s) => ({ id: card.id, n: s.n + 1 }));
      toast(explainIllegal(pub, uid, card));
      return;
    }
    if (isWild(card)) return setWildCard(card);
    run({ type: 'play', cardId: card.id }, card.id);
  }

  function onPickColor(color: Color) {
    if (!wildCard) return;
    run({ type: 'play', cardId: wildCard.id, chosenColor: color }, wildCard.id);
    setWildCard(null);
  }

  // Any client nudges the server when the current turn's deadline has passed.
  const now = useNow(1000);
  const timeoutSentFor = useRef(0);
  useEffect(() => {
    if (pub.status !== 'playing' || now < pub.turnDeadline + 1500 || timeoutSentFor.current === pub.turnDeadline) return;
    timeoutSentFor.current = pub.turnDeadline;
    sendAction(code, { type: 'timeout' }).catch(() => { timeoutSentFor.current = 0; });
  }, [now, pub.turnDeadline, pub.status, code]);

  // Shake the table when a +4 lands.
  const firstSeq = useRef(pub.lastAction.seq);
  useEffect(() => {
    const a = pub.lastAction;
    if (a.seq !== firstSeq.current && (a.type === 'play' || a.type === 'jump') && a.card?.value === 'wild4') {
      shakeTable.start({ x: [0, -14, 14, -10, 10, -4, 0], transition: { duration: 0.5 } });
    }
  }, [pub.lastAction, shakeTable]);

  const la = pub.lastAction;
  const enterFrom = (la.type === 'play' || la.type === 'jump') && la.card?.id === pub.topCard.id ? posOf(la.playerId) : PILE_POS;
  const myTurn = pub.turnPlayerId === uid;

  async function playAgain() {
    setBusy(true);
    try { await api('room/start', { code }); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  async function leave() {
    await api('room/leave', { code }).catch(() => {});
    router.push('/');
  }

  return (
    <motion.main animate={shakeTable} className="fixed inset-0 select-none overflow-hidden">
      <div className="felt-wrap"><div className="felt" /></div>

      <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between p-3">
        <span className="rounded-full bg-black/50 px-3 py-1 font-display tracking-widest text-yellow-300">{code}</span>
        <RulesButton />
      </div>
      {offline && (
        <div className="absolute inset-x-0 top-14 z-50 mx-auto w-fit rounded-full bg-red-600 px-4 py-1 text-sm font-bold">Reconnecting…</div>
      )}

      {opponents.map((p, i) => (
        <Seat key={p.id} player={p} pos={seats[i]} isTurn={pub.turnPlayerId === p.id} deadline={pub.turnDeadline}
          catchable={pub.catchable === p.id} onCatch={() => run({ type: 'catch', targetId: p.id })} />
      ))}

      <CenterPile pub={pub} size={size} enterFrom={enterFrom} canDraw={myTurn && !pub.drawnCardId}
        onDraw={() => run({ type: 'draw' })} />

      <ActionBar pub={pub} uid={uid} handCount={hand.length}
        onDraw={() => run({ type: 'draw' })} onPass={() => run({ type: 'pass' })} onJuan={() => run({ type: 'callJuan' })} />

      <Hand cards={hand} legal={legal} size={size} width={width} shake={shake} onPlay={onPlay} />

      <Effects lastAction={pub.lastAction} nameOf={nameOf} posOf={posOf} />
      <ColorPicker open={!!wildCard} onPick={onPickColor} onCancel={() => setWildCard(null)} />
      {pub.status === 'finished' && (
        <WinnerOverlay winnerName={nameOf(pub.winnerId ?? '')} isMe={pub.winnerId === uid} isHost={room.hostId === uid}
          busy={busy} onPlayAgain={playAgain} onLeave={leave} />
      )}
    </motion.main>
  );
}
