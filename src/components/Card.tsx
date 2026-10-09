import type { Card, Color, Value } from '@/game/types';

export const COLOR_HEX: Record<Color, string> = { red: '#e53935', yellow: '#fdd835', green: '#43a047', blue: '#1e88e5' };

const LABEL: Record<Value, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4',
};

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

export function CardFace({ card, size = 'md' }: { card: Card; size?: CardSize }) {
  const label = LABEL[card.value];
  const bg = card.color ? COLOR_HEX[card.color] : '#16161a';
  return (
    <div className={`juan-card juan-card--${size}`} style={{ background: bg }}>
      <div className={`juan-card__oval ${card.color ? '' : 'juan-card__oval--wild'}`} />
      <span className="juan-card__label" style={{ color: card.color ? bg : '#fff' }}>{label}</span>
      <span className="juan-card__corner juan-card__corner--tl">{label}</span>
      <span className="juan-card__corner juan-card__corner--br">{label}</span>
      <div className="juan-card__shine" />
    </div>
  );
}

export function CardBack({ size = 'md' }: { size?: CardSize }) {
  return (
    <div className={`juan-card juan-card--${size} juan-back`}>
      <div className="juan-card__oval" />
      <span className="juan-back__logo">JUAN</span>
      <div className="juan-card__shine" />
    </div>
  );
}
