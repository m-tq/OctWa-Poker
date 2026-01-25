import type { Card } from '@/types/game';
import { PlayingCard } from './PlayingCard';

interface CommunityCardsProps {
  cards: Card[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  // Always show 5 card slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] || null);

  return (
    <div className="flex gap-2 justify-center">
      {slots.map((card, index) => (
        <div 
          key={index}
          className={`transition-all duration-300 ${card ? 'animate-card-deal' : ''}`}
        >
          {card ? (
            <PlayingCard card={card} size="lg" />
          ) : (
            <div className="w-16 h-24 border border-dashed border-white/20 bg-white/5" />
          )}
        </div>
      ))}
    </div>
  );
}
