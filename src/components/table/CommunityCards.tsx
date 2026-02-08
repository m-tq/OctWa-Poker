import type { Card } from "@/types/game";
import { PlayingCard } from "./PlayingCard";

interface CommunityCardsProps {
  cards: Card[];
  stage?: string;
}

export function CommunityCards({ cards, stage }: CommunityCardsProps) {
  // Always show 5 card slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] || null);

  // Determine which cards are newly dealt for animation
  const getAnimationDelay = (index: number): string => {
    if (!cards[index]) return "";
    // Stagger animation for flop (first 3), turn (4th), river (5th)
    if (index < 3) return `${index * 100}ms`;
    return "0ms";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Stage label */}
      {stage && cards.length > 0 && (
        <div className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-medium mb-1">
          {stage}
        </div>
      )}

      {/* Cards row */}
      <div className="flex gap-2 sm:gap-3 justify-center items-center">
        {slots.map((card, index) => (
          <div
            key={index}
            className={`
              transition-all duration-300
              ${card ? "animate-card-deal" : ""}
            `}
            style={{
              animationDelay: getAnimationDelay(index),
              animationFillMode: "both",
            }}
          >
            {card ? (
              <PlayingCard card={card} size="community" />
            ) : (
              <div
                className="
                  w-[80px] h-[112px]
                  sm:w-[90px] sm:h-[126px]
                  md:w-[100px] md:h-[140px]
                  rounded-lg border border-dashed border-white/15
                  bg-white/5 backdrop-blur-sm
                  flex items-center justify-center
                  flex-shrink-0
                "
              >
                <span className="text-white/10 text-2xl select-none">?</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
