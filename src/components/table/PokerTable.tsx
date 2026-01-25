import type { Table, Card } from '@/types/game';
import { PlayerSeat } from './PlayerSeat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';

interface PokerTableProps {
  table: Table;
  myPlayerId?: string;
  myHoleCards?: Card[] | null;
  timeRemaining?: number;
}

type SeatPosition = { top: string; left: string; transform: string };

// Generate seat positions based on number of players
// Seats are distributed evenly around an ellipse
function getSeatPositions(maxPlayers: number): SeatPosition[] {
  const positions: SeatPosition[] = [];
  
  // Predefined layouts for common player counts
  const layouts: Record<number, SeatPosition[]> = {
    2: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom (me)
      { top: '5%', left: '50%', transform: 'translate(-50%, -50%)' },   // Top
    ],
    3: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom (me)
      { top: '20%', left: '15%', transform: 'translate(-50%, -50%)' },  // Top left
      { top: '20%', left: '85%', transform: 'translate(-50%, -50%)' },  // Top right
    ],
    4: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom (me)
      { top: '50%', left: '5%', transform: 'translate(-50%, -50%)' },   // Left
      { top: '5%', left: '50%', transform: 'translate(-50%, -50%)' },   // Top
      { top: '50%', left: '95%', transform: 'translate(-50%, -50%)' },  // Right
    ],
    5: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom (me)
      { top: '65%', left: '8%', transform: 'translate(-50%, -50%)' },   // Bottom left
      { top: '15%', left: '15%', transform: 'translate(-50%, -50%)' },  // Top left
      { top: '15%', left: '85%', transform: 'translate(-50%, -50%)' },  // Top right
      { top: '65%', left: '92%', transform: 'translate(-50%, -50%)' },  // Bottom right
    ],
    6: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom (me)
      { top: '60%', left: '5%', transform: 'translate(-50%, -50%)' },   // Left bottom
      { top: '20%', left: '5%', transform: 'translate(-50%, -50%)' },   // Left top
      { top: '5%', left: '50%', transform: 'translate(-50%, -50%)' },   // Top
      { top: '20%', left: '95%', transform: 'translate(-50%, -50%)' },  // Right top
      { top: '60%', left: '95%', transform: 'translate(-50%, -50%)' },  // Right bottom
    ],
    7: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom (me)
      { top: '70%', left: '8%', transform: 'translate(-50%, -50%)' },   // Bottom left
      { top: '35%', left: '3%', transform: 'translate(-50%, -50%)' },   // Left
      { top: '8%', left: '25%', transform: 'translate(-50%, -50%)' },   // Top left
      { top: '8%', left: '75%', transform: 'translate(-50%, -50%)' },   // Top right
      { top: '35%', left: '97%', transform: 'translate(-50%, -50%)' },  // Right
      { top: '70%', left: '92%', transform: 'translate(-50%, -50%)' },  // Bottom right
    ],
    8: [
      { top: '88%', left: '50%', transform: 'translate(-50%, -50%)' },  // Bottom center (me)
      { top: '75%', left: '8%', transform: 'translate(-50%, -50%)' },   // Bottom left
      { top: '40%', left: '2%', transform: 'translate(-50%, -50%)' },   // Left
      { top: '12%', left: '15%', transform: 'translate(-50%, -50%)' },  // Top left
      { top: '5%', left: '50%', transform: 'translate(-50%, -50%)' },   // Top center
      { top: '12%', left: '85%', transform: 'translate(-50%, -50%)' },  // Top right
      { top: '40%', left: '98%', transform: 'translate(-50%, -50%)' },  // Right
      { top: '75%', left: '92%', transform: 'translate(-50%, -50%)' },  // Bottom right
    ],
  };

  // Use predefined layout if available
  if (layouts[maxPlayers]) {
    return layouts[maxPlayers];
  }

  // Fallback: generate positions around ellipse for any number
  for (let i = 0; i < maxPlayers; i++) {
    // Start from bottom (270 degrees) and go clockwise
    const angle = (270 + (360 / maxPlayers) * i) * (Math.PI / 180);
    // Ellipse radii (percentage based)
    const rx = 45; // horizontal radius
    const ry = 40; // vertical radius
    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);
    
    positions.push({
      top: `${y}%`,
      left: `${x}%`,
      transform: 'translate(-50%, -50%)',
    });
  }

  return positions;
}

export function PokerTable({ table, myPlayerId, myHoleCards, timeRemaining }: PokerTableProps) {
  const hand = table.currentHand;
  const dealerIndex = hand?.dealerIndex ?? -1;
  const activePlayerIndex = hand?.activePlayerIndex ?? -1;
  
  // Get seat positions based on table's maxPlayers
  const seatPositions = getSeatPositions(table.maxPlayers);

  return (
    <div className="absolute inset-2 overflow-hidden">
      {/* Table felt - oval shape */}
      <div 
        className="absolute rounded-[50%] border-[6px]"
        style={{
          top: '18%',
          left: '12%',
          right: '12%',
          bottom: '18%',
          backgroundColor: '#1a5f3c',
          borderColor: '#8b4513',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Inner felt pattern */}
        <div 
          className="absolute inset-4 rounded-[50%] border border-white/10"
          style={{
            background: 'radial-gradient(ellipse at center, #1e6b42 0%, #1a5f3c 100%)',
          }}
        />
        
        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          {/* Pot */}
          {hand && hand.pot > 0 && (
            <PotDisplay 
              pot={hand.pot} 
              sidePots={hand.sidePots}
            />
          )}

          {/* Community cards */}
          {hand && hand.communityCards && hand.communityCards.length > 0 && (
            <CommunityCards cards={hand.communityCards} />
          )}

          {/* Stage indicator */}
          {hand && (
            <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
              {hand.stage}
            </div>
          )}
          
          {/* Waiting message when no hand */}
          {!hand && (
            <div className="text-white/40 text-sm">
              Waiting for players...
            </div>
          )}
        </div>
      </div>

      {/* Player seats */}
      {table.players.map((player, index) => {
        const position = seatPositions[index];
        if (!position) return null;
        
        const isMe = player?.id === myPlayerId;
        const isCurrentTurn = index === activePlayerIndex;
        const isDealer = index === dealerIndex;
        
        // Show hole cards for current player
        const holeCards = isMe ? myHoleCards : player?.holeCards;
        const showCards = isMe || hand?.stage === 'showdown';

        return (
          <div
            key={index}
            className="absolute z-20"
            style={position}
          >
            <PlayerSeat
              player={player}
              seatIndex={index}
              isCurrentTurn={isCurrentTurn}
              isDealer={isDealer}
              isMe={isMe}
              holeCards={holeCards}
              showCards={showCards}
              timeRemaining={isCurrentTurn ? timeRemaining : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
