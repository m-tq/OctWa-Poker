import type { Card } from '@/types/game';
import { suitSymbol } from '@/game/Deck';

interface PlayingCardProps {
  card: Card | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlayingCard({ card, faceDown = false, size = 'md', className = '' }: PlayingCardProps) {
  const sizes = {
    xs: 'w-6 h-9 text-[8px]',
    sm: 'w-8 h-12 text-xs',
    md: 'w-12 h-16 text-sm',
    lg: 'w-16 h-24 text-base',
  };

  const sizeClass = sizes[size];
  const isRed = card?.suit === 'H' || card?.suit === 'D';

  if (faceDown || !card) {
    return (
      <div 
        className={`${sizeClass} rounded bg-blue-800 border border-blue-600 flex items-center justify-center ${className}`}
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
        }}
        aria-label="Face down card"
      >
        <div className="w-3/4 h-3/4 border border-white/20 rounded-sm flex items-center justify-center">
          <span className="text-white/30">♠</span>
        </div>
      </div>
    );
  }

  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const suitDisplay = suitSymbol(card.suit);

  return (
    <div 
      className={`${sizeClass} bg-white rounded shadow-md flex flex-col items-center justify-center ${className}`}
      aria-label={`${rankDisplay} of ${card.suit === 'H' ? 'Hearts' : card.suit === 'D' ? 'Diamonds' : card.suit === 'C' ? 'Clubs' : 'Spades'}`}
    >
      <div className={`font-bold leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rankDisplay}
      </div>
      <div className={`${size === 'xs' ? 'text-sm' : 'text-lg'} leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {suitDisplay}
      </div>
    </div>
  );
}
