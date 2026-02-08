import type { Card } from "@/types/game";
import { suitSymbol } from "@/game/Deck";

interface PlayingCardProps {
  card: Card | null;
  faceDown?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "community";
  className?: string;
  highlighted?: boolean;
}

const SIZE_CONFIG = {
  xs: {
    container: "w-8 h-12",
    rank: "text-[10px] leading-none",
    suit: "text-[12px] leading-none",
    backIcon: "text-[10px]",
    padding: "p-0.5",
    cornerRank: "text-[8px]",
    cornerSuit: "text-[8px]",
    showCorners: false,
    centerSuit: "text-lg",
  },
  sm: {
    container: "w-11 h-16",
    rank: "text-sm leading-none",
    suit: "text-base leading-none",
    backIcon: "text-xs",
    padding: "p-1",
    cornerRank: "text-[9px]",
    cornerSuit: "text-[9px]",
    showCorners: false,
    centerSuit: "text-xl",
  },
  md: {
    container: "w-14 h-20",
    rank: "text-lg font-bold leading-none",
    suit: "text-xl leading-none",
    backIcon: "text-sm",
    padding: "p-1.5",
    cornerRank: "text-[10px]",
    cornerSuit: "text-[10px]",
    showCorners: true,
    centerSuit: "text-2xl",
  },
  lg: {
    container: "w-[72px] h-[100px]",
    rank: "text-2xl font-bold leading-none",
    suit: "text-2xl leading-none",
    backIcon: "text-base",
    padding: "p-2",
    cornerRank: "text-xs font-bold",
    cornerSuit: "text-xs",
    showCorners: true,
    centerSuit: "text-3xl",
  },
  xl: {
    container: "w-[88px] h-[124px]",
    rank: "text-3xl font-bold leading-none",
    suit: "text-3xl leading-none",
    backIcon: "text-lg",
    padding: "p-2.5",
    cornerRank: "text-sm font-bold",
    cornerSuit: "text-sm",
    showCorners: true,
    centerSuit: "text-4xl",
  },
  // PokerNow-style large community cards
  community: {
    container:
      "w-[80px] h-[112px] sm:w-[90px] sm:h-[126px] md:w-[100px] md:h-[140px]",
    rank: "text-3xl sm:text-4xl font-black leading-none",
    suit: "text-3xl sm:text-4xl leading-none",
    backIcon: "text-lg",
    padding: "p-2",
    cornerRank: "text-sm font-bold",
    cornerSuit: "text-sm",
    showCorners: true,
    centerSuit: "text-5xl",
  },
};

export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  className = "",
  highlighted = false,
}: PlayingCardProps) {
  const config = SIZE_CONFIG[size];
  const isRed = card?.suit === "H" || card?.suit === "D";

  // Face-down card (back design)
  if (faceDown || !card) {
    return (
      <div
        className={`
          ${config.container} rounded-lg relative overflow-hidden
          shadow-lg border border-blue-400/30 flex-shrink-0
          ${className}
        `}
        style={{
          background:
            "linear-gradient(145deg, #1e3a6e 0%, #152a52 50%, #0f1f3d 100%)",
        }}
        aria-label="Face down card"
      >
        {/* Inner pattern border */}
        <div className="absolute inset-[3px] rounded-md border border-blue-300/20 flex items-center justify-center">
          {/* Diamond pattern */}
          <div className="grid grid-cols-3 gap-[2px] opacity-30">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-blue-300/40 rotate-45" />
            ))}
          </div>
        </div>
        {/* Subtle OctWa brand mark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-blue-300/10 font-bold text-lg select-none">
            ♠
          </span>
        </div>
      </div>
    );
  }

  const rankDisplay = card.rank === "T" ? "10" : card.rank;
  const suitDisplay = suitSymbol(card.suit);
  const suitFullName =
    card.suit === "H"
      ? "Hearts"
      : card.suit === "D"
        ? "Diamonds"
        : card.suit === "C"
          ? "Clubs"
          : "Spades";

  const textColor = isRed ? "text-red-600" : "text-gray-900";
  const darkTextColor = isRed ? "text-red-500" : "text-gray-800";

  return (
    <div
      className={`
        ${config.container} rounded-lg relative overflow-hidden flex-shrink-0
        shadow-lg border transition-all duration-200
        ${
          highlighted
            ? "border-yellow-400 shadow-yellow-400/30 ring-1 ring-yellow-400/50"
            : "border-gray-200/60 shadow-black/20"
        }
        ${className}
      `}
      style={{
        background:
          "linear-gradient(165deg, #ffffff 0%, #f8f8f8 40%, #f0f0f0 100%)",
      }}
      aria-label={`${rankDisplay} of ${suitFullName}`}
    >
      {/* Top-left corner */}
      {config.showCorners && (
        <div
          className={`absolute top-1 left-1.5 flex flex-col items-center ${darkTextColor}`}
        >
          <span className={config.cornerRank}>{rankDisplay}</span>
          <span className={`${config.cornerSuit} -mt-0.5`}>{suitDisplay}</span>
        </div>
      )}

      {/* Center content - large rank + suit */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className={`${config.rank} ${textColor} select-none`}>
          {rankDisplay}
        </span>
        <span className={`${config.suit} ${textColor} select-none`}>
          {suitDisplay}
        </span>
      </div>

      {/* Bottom-right corner (rotated) */}
      {config.showCorners && (
        <div
          className={`absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 ${darkTextColor}`}
        >
          <span className={config.cornerRank}>{rankDisplay}</span>
          <span className={`${config.cornerSuit} -mt-0.5`}>{suitDisplay}</span>
        </div>
      )}

      {/* Subtle inner highlight for depth */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 40%)",
        }}
      />
    </div>
  );
}
