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
import { useChangeEffect, useNow, useViewport } from '@/lib/hooks';
import { serverNow } from '@/lib/serverClock';
import { explainIllegal, isWild, legalCardIds } from '@/game/rules';
import { activeLobby, canStartGame, type RoomDoc } from '@/game/room';
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
  const { width, height } = useViewport();
  const size = Math.min(width, height) >= 700 ? 'lg' : 'md';
  const compact = width < 640;

  const n = pub.players.length;
  const myIdx = Math.max(0, pub.players.findIndex((p) => p.id === uid));
  const opponents = useMemo(() => Array.from({ length: n - 1 }, (_, k) => pub.players[(myIdx + k + 1) % n]), [pub.players, myIdx, n]);
  const seats = useMemo(() => seatPositions(opponents.length, compact), [opponents.length, compact]);

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

  // Drop a half-finished wild play once it no longer applies. Not on every turn change: an
  // out-of-turn wild-on-wild jump stays open for as long as it's still legal.
  useEffect(() => setWildCard(null), [pub.status]);
  useEffect(() => {
    if (wildCard && !legal.has(wildCard.id)) setWildCard(null);
  }, [wildCard, legal]);

  // One play/draw/pass in flight at a time, so a double tap sends a single request.
  // `pendingSince` is when the in-flight one was sent (0 = none).
  const pendingSince = useRef(0);
  /** True (and tells the player, if it's been a while) when a turn action is still in flight. */
  const stillSending = useCallback(() => {
    if (!pendingSince.current) return false;
    if (Date.now() - pendingSince.current > 3000) toast('Still sending your last move…');
    return true;
  }, []);
  const run = useCallback(async (action: Action, cardId?: string): Promise<boolean> => {
    const guarded = action.type === 'play' || action.type === 'draw' || action.type === 'pass';
    if (guarded) {
      if (stillSending()) return false;
      pendingSince.current = Date.now();
    }
    try {
      await sendAction(code, action);
      return true;
    } catch (e) {
      toast((e as Error).message);
      if (cardId) setShake((s) => ({ id: cardId, n: s.n + 1 }));
      return false;
    } finally {
      if (guarded) pendingSince.current = 0;
    }
  }, [code, stillSending]);

  // Hide JUAN! as soon as it's pressed, until the next snapshot (new action seq) arrives.
  const [juanSentAtSeq, setJuanSentAtSeq] = useState<number | null>(null);
  async function onJuan() {
    setJuanSentAtSeq(pub.lastAction.seq);
    if (!(await run({ type: 'callJuan' }))) setJuanSentAtSeq(null);
  }

  function onPlay(card: Card) {
    if (stillSending()) return;
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

  // Any client nudges the server when the current turn's deadline has passed. Staggered by seat
  // distance from the turn player (in play order) so usually just one client sends it.
  // Deadlines are on the server's clock; after a failed attempt, wait before retrying.
  const tick = useNow(1000);
  const timeoutSentFor = useRef(0);
  const timeoutRetryAt = useRef(0);
  const turnIdx = pub.players.findIndex((p) => p.id === pub.turnPlayerId);
  const seatDistance = turnIdx < 0 ? 0 : ((((myIdx - turnIdx) * pub.direction) % n) + n) % n;
  const timeoutDelay = 1500 + 1000 * seatDistance;
  useEffect(() => {
    if (pub.status !== 'playing' || serverNow() < pub.turnDeadline + timeoutDelay || timeoutSentFor.current === pub.turnDeadline) return;
    if (Date.now() < timeoutRetryAt.current) return;
    timeoutSentFor.current = pub.turnDeadline;
    sendAction(code, { type: 'timeout' }).catch(() => {
      timeoutSentFor.current = 0;
      timeoutRetryAt.current = Date.now() + 3000;
    });
  }, [tick, pub.turnDeadline, pub.status, code, timeoutDelay]);

  // Shake the table when a +4 lands (only for new actions, not metadata-only snapshots).
  useChangeEffect(pub.lastAction.seq, () => {
    const a = pub.lastAction;
    if ((a.type === 'play' || a.type === 'jump') && a.card?.value === 'wild4') {
      shakeTable.start({ x: [0, -14, 14, -10, 10, -4, 0], transition: { duration: 0.5 } });
    }
  });

  const la = pub.lastAction;
  const enterFrom = (la.type === 'play' || la.type === 'jump') && la.card?.id === pub.topCard.id ? posOf(la.playerId) : PILE_POS;
  const myTurn = pub.turnPlayerId === uid;

  async function playAgain() {
    setBusy(true);
    try { await api('room/start', { code }); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  async function leave() {
    try {
      await api('room/leave', { code });
      router.push('/');
    } catch (e) {
      toast((e as Error).message);
    }
  }

  // In-game Leave needs a second tap within a few seconds.
  const [leaveArmed, setLeaveArmed] = useState(false);
  useEffect(() => {
    if (!leaveArmed) return;
    const t = setTimeout(() => setLeaveArmed(false), 3000);
    return () => clearTimeout(t);
  }, [leaveArmed]);

  const away = useMemo(() => {
    const active = new Set(activeLobby(room).map((p) => p.id));
    return new Set(room.lobby.filter((p) => !active.has(p.id)).map((p) => p.id));
  }, [room]);

  return (
    <motion.main animate={shakeTable} className="fixed inset-0 select-none overflow-hidden">
      <div className="felt-wrap"><div className="felt" /></div>

      <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between p-3">
        <span className="rounded-full bg-black/50 px-3 py-1 font-display tracking-widest text-yellow-300">{code}</span>
        <div className="flex items-center gap-2">
          {pub.status === 'playing' && (
            <button onClick={() => (leaveArmed ? leave() : setLeaveArmed(true))}
              className={`h-10 rounded-full px-4 text-sm font-bold ring-1 backdrop-blur transition-colors ${leaveArmed ? 'bg-red-600 ring-red-400' : 'bg-white/10 ring-white/20 hover:bg-white/20'}`}>
              {leaveArmed ? 'Tap to leave' : 'Leave'}
            </button>
          )}
          <RulesButton />
        </div>
      </div>
      {offline && (
        <div className="absolute inset-x-0 top-14 z-50 mx-auto w-fit rounded-full bg-red-600 px-4 py-1 text-sm font-bold">Reconnecting…</div>
      )}

      {opponents.map((p, i) => (
        <Seat key={p.id} player={p} pos={seats[i]} isTurn={pub.turnPlayerId === p.id} deadline={pub.turnDeadline}
          catchable={pub.catchable === p.id} compact={compact} onCatch={() => run({ type: 'catch', targetId: p.id })} />
      ))}

      <CenterPile pub={pub} size={size} enterFrom={enterFrom} canDraw={myTurn && !pub.drawnCardId}
        onDraw={() => run({ type: 'draw' })} />

      <ActionBar pub={pub} uid={uid} handCount={hand.length}
        onDraw={() => run({ type: 'draw' })} onPass={() => run({ type: 'pass' })} juanHidden={juanSentAtSeq === pub.lastAction.seq} onJuan={onJuan} />

      <Hand cards={hand} legal={legal} size={size} width={width} shake={shake} onPlay={onPlay} />

      <Effects lastAction={pub.lastAction} nameOf={nameOf} posOf={posOf} />
      <ColorPicker open={!!wildCard} onPick={onPickColor} onCancel={() => setWildCard(null)} />
      {pub.status === 'finished' && (
        <WinnerOverlay code={code} uid={uid} lobby={room.lobby} away={away}
          winnerName={nameOf(pub.winnerId ?? '')} isMe={pub.winnerId === uid} isHost={canStartGame(room, uid)}
          busy={busy} onPlayAgain={playAgain} onLeave={leave} />
      )}
    </motion.main>
  );
}
