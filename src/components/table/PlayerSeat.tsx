import type { Player, Card } from '@/types/game';
import { PlayingCard } from './PlayingCard';
import { Badge } from '@/components/ui/Badge';

interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isMe?: boolean;
  holeCards?: Card[] | null;
  showCards?: boolean;
  timeRemaining?: number;
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
}: PlayerSeatProps) {
  // Empty seat
  if (!player) {
    return (
      <div className="w-24 h-16 rounded-lg border border-dashed border-white/20 bg-black/20 flex items-center justify-center">
        <span className="text-white/30 text-[10px]">Seat {seatIndex + 1}</span>
      </div>
    );
  }

  const truncatedName = player.name.length > 10 
    ? `${player.name.slice(0, 10)}..` 
    : player.name;

  const isUrgent = isCurrentTurn && timeRemaining !== undefined && timeRemaining <= 10;

  return (
    <div className="relative">
      {/* Turn indicator glow effect */}
      {isCurrentTurn && (
        <div 
          className={`absolute -inset-1 rounded-xl ${isUrgent ? 'bg-red-500/30 animate-pulse' : 'bg-yellow-400/20'}`}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Player card */}
      <div 
        className={`
          relative w-24 rounded-lg overflow-hidden transition-all
          ${isMe ? 'ring-2 ring-primary' : ''}
          ${isCurrentTurn ? `ring-2 ${isUrgent ? 'ring-red-500' : 'ring-yellow-400'} shadow-lg ${isUrgent ? 'shadow-red-500/30' : 'shadow-yellow-400/30'}` : ''}
          ${player.status === 'folded' ? 'opacity-40' : ''}
          ${!player.isConnected ? 'opacity-60' : ''}
        `}
        style={{
          background: isMe ? 'linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%)' : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
        }}
      >
        {/* Turn label */}
        {isCurrentTurn && (
          <div className={`absolute top-0 left-0 right-0 text-center text-[8px] font-bold py-0.5 ${isUrgent ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black'}`}>
            {isMe ? '⏱️ YOUR TURN!' : 'TURN'}
          </div>
        )}

        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-1 -left-1 w-5 h-5 bg-yellow-400 text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-10">
            D
          </div>
        )}

        {/* Disconnected indicator */}
        {!player.isConnected && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse z-10" title="Disconnected" />
        )}

        {/* Player info */}
        <div className={`p-1.5 ${isCurrentTurn ? 'pt-4' : ''}`}>
          <div className="text-[10px] text-white font-medium truncate mb-0.5" title={player.name}>
            {truncatedName} {isMe && <span className="text-primary">(You)</span>}
          </div>
          
          <div className="text-xs font-bold text-white">
            {player.stack.toLocaleString()} OCT
          </div>

          {/* Current bet */}
          {player.bet > 0 && (
            <div className="text-[10px] text-yellow-400 mt-0.5">
              Bet: {player.bet.toLocaleString()}
            </div>
          )}

          {/* Status badges */}
          {player.status === 'all-in' && (
            <Badge variant="danger" size="sm" className="mt-0.5 text-[8px] px-1 py-0">
              ALL-IN
            </Badge>
          )}
          {player.status === 'folded' && (
            <Badge variant="muted" size="sm" className="mt-0.5 text-[8px] px-1 py-0">
              FOLD
            </Badge>
          )}
        </div>

        {/* Hole cards */}
        {holeCards && holeCards.length > 0 && (
          <div className="flex gap-0.5 justify-center pb-1.5 px-1">
            {holeCards.map((card, i) => (
              <PlayingCard 
                key={i} 
                card={card} 
                faceDown={!showCards && player.status !== 'folded'}
                size="xs"
              />
            ))}
          </div>
        )}
      </div>

      {/* Turn timer */}
      {isCurrentTurn && timeRemaining !== undefined && (
        <div className="absolute -bottom-5 left-0 right-0">
          <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-yellow-400'}`}
              style={{ width: `${(timeRemaining / 30) * 100}%` }}
            />
          </div>
          <div className={`text-[10px] text-center mt-0.5 font-medium ${isUrgent ? 'text-red-400' : 'text-white/60'}`}>
            {timeRemaining}s {isUrgent && '⚠️'}
          </div>
        </div>
      )}
    </div>
  );
}
