'use client';
import { motion } from 'motion/react';
import { TurnRing } from './TurnRing';
import type { PublicState } from '@/game/types';

interface Props {
  pub: PublicState;
  uid: string;
  handCount: number;
  /** JUAN! was just pressed; hide it until the server's answer arrives. */
  juanHidden: boolean;
  onDraw: () => void;
  onPass: () => void;
  onJuan: () => void;
}

export function ActionBar({ pub, uid, handCount, juanHidden, onDraw, onPass, onJuan }: Props) {
  const me = pub.players.find((p) => p.id === uid);
  const myTurn = pub.turnPlayerId === uid;
  const turnName = pub.players.find((p) => p.id === pub.turnPlayerId)?.name ?? '';
  let status = `${turnName}'s turn`;
  if (myTurn) {
    if (pub.pendingDraw) status = `+${pub.pendingDraw.count} on you! Stack a ${pub.pendingDraw.kind === 'draw2' ? '+2' : '+4'} or draw`;
    else if (pub.drawnCardId) status = 'Play the card you drew, or pass';
    else status = 'Your turn!';
  }
  const showJuan = !juanHidden && ((handCount === 2 && !me?.calledJuan) || pub.catchable === uid);

  return (
    <div className="absolute left-1/2 top-[61%] z-40 flex w-full -translate-x-1/2 flex-col items-center gap-2 px-2">
      <div className="flex items-center gap-2">
        {myTurn && <TurnRing deadline={pub.turnDeadline} size={34}><span className="text-[10px]">⏱</span></TurnRing>}
        <motion.span key={status} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className={`rounded-full px-4 py-1.5 text-center text-sm font-bold ${myTurn ? 'bg-yellow-300 text-black' : 'bg-black/55'}`}>
          {status}
        </motion.span>
      </div>
      <div className="flex gap-2">
        {myTurn && !pub.drawnCardId && (
          <button className="btn btn-blue px-4 py-2 text-base" onClick={onDraw}>
            {pub.pendingDraw ? `Draw ${pub.pendingDraw.count}` : 'Draw'}
          </button>
        )}
        {myTurn && pub.drawnCardId && <button className="btn btn-gray px-4 py-2 text-base" onClick={onPass}>Pass</button>}
        {showJuan && (
          <motion.button className="btn btn-red px-4 py-2 text-base" onClick={onJuan}
            animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
            JUAN!
          </motion.button>
        )}
      </div>
    </div>
  );
}
