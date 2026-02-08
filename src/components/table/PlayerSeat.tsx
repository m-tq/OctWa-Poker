import type { Player, Card } from "@/types/game";
import { PlayingCard } from "./PlayingCard";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowRightFromLine,
  ArrowLeftFromLine,
  Clock,
  WifiOff,
  X,
} from "lucide-react";

interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isMe?: boolean;
  holeCards?: Card[] | null;
  showCards?: boolean;
  timeRemaining?: number;
  onSeatClick?: (seatIndex: number) => void;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
}

export function PlayerSeat({
  player,
  seatIndex,
  isCurrentTurn,
  isDealer,
  isMe = false,
  holeCards,
  showCards = false,
  timeRemaining,
  onSeatClick,
  isSmallBlind = false,
  isBigBlind = false,
}: PlayerSeatProps) {
  // Empty seat
  if (!player) {
    return (
      <button
        onClick={() => onSeatClick?.(seatIndex)}
        className="
          group w-28 h-[70px] rounded-xl
          border border-dashed border-white/20
          bg-black/30 backdrop-blur-sm
          flex flex-col items-center justify-center
          hover:border-green-400/50 hover:bg-black/40
          transition-all duration-200 cursor-pointer
        "
        aria-label={`Empty seat ${seatIndex + 1} - click to sit`}
      >
        <span className="text-white/30 text-[10px] font-medium group-hover:text-green-400/60 transition-colors">
          Seat {seatIndex + 1}
        </span>
        <span className="text-white/15 text-[9px] group-hover:text-green-400/40 transition-colors">
          click to sit
        </span>
      </button>
    );
  }

  const truncatedName =
    player.name.length > 12 ? `${player.name.slice(0, 11)}…` : player.name;

  const isUrgent =
    isCurrentTurn && timeRemaining !== undefined && timeRemaining <= 10;
  const isFolded = player.status === "folded";
  const isAllIn = player.status === "all-in";
  const isAway = player.status === "away";
  const isSittingOut = player.status === "sitting-out";
  const isQuitting = player.status === "quitting";
  const isInNextHand = player.status === "in-next-hand";
  const isInactive = isFolded || isSittingOut || isAway || isQuitting;

  // Status icon overlay
  const renderStatusIcon = () => {
    if (isFolded) {
      return (
        <div className="absolute -top-1 -left-1 z-20 w-7 h-7 rounded-full bg-gray-700/90 border border-gray-500/50 flex items-center justify-center shadow-md">
          <X className="w-4 h-4 text-gray-400" />
        </div>
      );
    }
    if (isAway) {
      return (
        <div className="absolute -top-1 -left-1 z-20 w-7 h-7 rounded-full bg-yellow-700/90 border border-yellow-500/50 flex items-center justify-center shadow-md">
          <Clock className="w-3.5 h-3.5 text-yellow-300" />
        </div>
      );
    }
    if (isQuitting) {
      return (
        <div className="absolute -top-1 -left-1 z-20 w-7 h-7 rounded-full bg-red-700/90 border border-red-500/50 flex items-center justify-center shadow-md">
          <ArrowRightFromLine className="w-3.5 h-3.5 text-red-300" />
        </div>
      );
    }
    if (isInNextHand) {
      return (
        <div className="absolute -top-1 -left-1 z-20 w-7 h-7 rounded-full bg-blue-700/90 border border-blue-500/50 flex items-center justify-center shadow-md">
          <ArrowLeftFromLine className="w-3.5 h-3.5 text-blue-300" />
        </div>
      );
    }
    return null;
  };

  // Fold / inactive label under status icon
  const renderStatusLabel = () => {
    if (isFolded) return "FOLD";
    if (isAway) return "AWAY";
    if (isSittingOut) return "SITTING OUT";
    if (isQuitting) return "QUITTING";
    if (isInNextHand) return "IN NEXT HAND";
    return null;
  };

  const statusLabel = renderStatusLabel();

  // Timer bar percentage
  const timerPercent =
    isCurrentTurn && timeRemaining !== undefined
      ? (timeRemaining / 30) * 100
      : 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Hole cards above the player card */}
      {holeCards && holeCards.length > 0 && (
        <div className="flex gap-1 justify-center mb-1 relative z-10">
          {holeCards.map((card, i) => (
            <PlayingCard
              key={i}
              card={card}
              faceDown={!showCards && !isFolded}
              size={isMe ? "sm" : "xs"}
              className={`
                ${isFolded ? "opacity-30 grayscale" : ""}
                ${isMe && showCards ? "hover:scale-110 transition-transform" : ""}
              `}
            />
          ))}
        </div>
      )}

      {/* Turn indicator glow */}
      {isCurrentTurn && (
        <div
          className={`
            absolute -inset-2 rounded-2xl z-0
            ${isUrgent ? "bg-red-500/25 animate-pulse" : "bg-yellow-400/15"}
          `}
          style={{ filter: "blur(8px)" }}
        />
      )}

      {/* Main player card */}
      <div
        className={`
          relative z-10 w-28 rounded-xl overflow-hidden transition-all duration-200
          ${isMe ? "ring-2 ring-blue-500/70 shadow-blue-500/20 shadow-lg" : ""}
          ${
            isCurrentTurn
              ? `ring-2 ${isUrgent ? "ring-red-500 shadow-red-500/30" : "ring-yellow-400 shadow-yellow-400/25"} shadow-lg`
              : ""
          }
          ${isInactive && !isCurrentTurn ? "opacity-50" : ""}
          ${!player.isConnected ? "opacity-60" : ""}
        `}
        style={{
          background: isMe
            ? "linear-gradient(145deg, #1a2f4a 0%, #0f1e33 100%)"
            : "linear-gradient(145deg, #2d2d2d 0%, #1a1a1a 100%)",
        }}
      >
        {/* Status icon overlay */}
        {renderStatusIcon()}

        {/* Dealer button */}
        {isDealer && (
          <div
            className="
              absolute -top-1 -right-1 z-20
              w-6 h-6 rounded-full
              bg-white text-gray-900
              text-[10px] font-black
              flex items-center justify-center
              shadow-lg border-2 border-gray-300
            "
            title="Dealer"
          >
            D
          </div>
        )}

        {/* Blind indicators */}
        {(isSmallBlind || isBigBlind) && !isDealer && (
          <div
            className={`
              absolute -top-1 -right-1 z-20
              px-1.5 py-0.5 rounded-full
              text-[8px] font-bold
              shadow-md border
              ${
                isSmallBlind
                  ? "bg-blue-600 text-white border-blue-400"
                  : "bg-orange-600 text-white border-orange-400"
              }
            `}
            title={isSmallBlind ? "Small Blind" : "Big Blind"}
          >
            {isSmallBlind ? "SB" : "BB"}
          </div>
        )}

        {/* Connection status */}
        {!player.isConnected && (
          <div className="absolute top-1 right-1 z-20" title="Disconnected">
            <WifiOff className="w-3 h-3 text-red-400" />
          </div>
        )}

        {/* Player info section */}
        <div className={`px-2 py-2 ${isCurrentTurn ? "pt-2" : ""}`}>
          {/* Player name */}
          <div
            className="text-[11px] text-white font-semibold truncate leading-tight"
            title={player.name}
          >
            {truncatedName}
            {isMe && (
              <span className="text-blue-400 ml-1 text-[9px]">(You)</span>
            )}
          </div>

          {/* Stack */}
          <div className="text-sm font-bold text-white mt-0.5 tabular-nums">
            {player.stack.toLocaleString()}
          </div>

          {/* Current bet chip */}
          {player.bet > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border border-yellow-300/50 shadow-sm flex-shrink-0" />
              <span className="text-[10px] text-yellow-400 font-medium tabular-nums">
                {player.bet.toLocaleString()}
              </span>
            </div>
          )}

          {/* Status badges */}
          <div className="mt-1 flex flex-wrap gap-0.5">
            {isAllIn && (
              <Badge
                variant="danger"
                size="sm"
                className="text-[8px] px-1.5 py-0 bg-red-600/80 border-red-500/50 animate-pulse"
              >
                ALL-IN
              </Badge>
            )}
            {statusLabel && !isAllIn && (
              <span className="text-[8px] text-white/40 uppercase tracking-wider font-medium">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Turn timer bar */}
      {isCurrentTurn && timeRemaining !== undefined && (
        <div className="w-28 mt-1.5 z-10 relative">
          <div className="h-[5px] bg-black/50 rounded-full overflow-hidden shadow-inner">
            <div
              className={`
                h-full rounded-full transition-all duration-1000 ease-linear
                ${isUrgent ? "bg-gradient-to-r from-red-600 to-red-400" : "bg-gradient-to-r from-yellow-500 to-yellow-300"}
              `}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          <div
            className={`
              text-[10px] text-center mt-0.5 font-semibold tabular-nums
              ${isUrgent ? "text-red-400" : "text-white/50"}
            `}
          >
            {timeRemaining}s{isUrgent && " ⚠️"}
          </div>
        </div>
      )}
    </div>
  );
}
