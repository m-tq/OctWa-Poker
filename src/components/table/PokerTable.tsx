import type { Table, Card } from "@/types/game";
import { PlayerSeat } from "./PlayerSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";

interface PokerTableProps {
  table: Table;
  myPlayerId?: string;
  myHoleCards?: Card[] | null;
  timeRemaining?: number;
  startGameButton?: React.ReactNode;
  onSeatClick?: (seatIndex: number) => void;
}

type SeatPosition = {
  top: string;
  left: string;
  transform: string;
};

// PokerNow-style seat positions — distributed around an oval table
// Bottom-center is "my seat" (index 0)
function getSeatPositions(maxPlayers: number): SeatPosition[] {
  const layouts: Record<number, SeatPosition[]> = {
    2: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" }, // bottom (me)
      { top: "6%", left: "50%", transform: "translate(-50%, -50%)" }, // top
    ],
    3: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "22%", left: "12%", transform: "translate(-50%, -50%)" },
      { top: "22%", left: "88%", transform: "translate(-50%, -50%)" },
    ],
    4: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "50%", left: "4%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "50%", left: "96%", transform: "translate(-50%, -50%)" },
    ],
    5: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "62%", left: "6%", transform: "translate(-50%, -50%)" },
      { top: "14%", left: "16%", transform: "translate(-50%, -50%)" },
      { top: "14%", left: "84%", transform: "translate(-50%, -50%)" },
      { top: "62%", left: "94%", transform: "translate(-50%, -50%)" },
    ],
    6: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "58%", left: "4%", transform: "translate(-50%, -50%)" },
      { top: "18%", left: "8%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "18%", left: "92%", transform: "translate(-50%, -50%)" },
      { top: "58%", left: "96%", transform: "translate(-50%, -50%)" },
    ],
    7: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "68%", left: "5%", transform: "translate(-50%, -50%)" },
      { top: "32%", left: "3%", transform: "translate(-50%, -50%)" },
      { top: "8%", left: "28%", transform: "translate(-50%, -50%)" },
      { top: "8%", left: "72%", transform: "translate(-50%, -50%)" },
      { top: "32%", left: "97%", transform: "translate(-50%, -50%)" },
      { top: "68%", left: "95%", transform: "translate(-50%, -50%)" },
    ],
    8: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" }, // bottom center (me)
      { top: "72%", left: "5%", transform: "translate(-50%, -50%)" }, // bottom left
      { top: "38%", left: "2%", transform: "translate(-50%, -50%)" }, // left
      { top: "10%", left: "18%", transform: "translate(-50%, -50%)" }, // top left
      { top: "6%", left: "50%", transform: "translate(-50%, -50%)" }, // top center
      { top: "10%", left: "82%", transform: "translate(-50%, -50%)" }, // top right
      { top: "38%", left: "98%", transform: "translate(-50%, -50%)" }, // right
      { top: "72%", left: "95%", transform: "translate(-50%, -50%)" }, // bottom right
    ],
    9: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "78%", left: "12%", transform: "translate(-50%, -50%)" },
      { top: "48%", left: "2%", transform: "translate(-50%, -50%)" },
      { top: "16%", left: "10%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "36%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "64%", transform: "translate(-50%, -50%)" },
      { top: "16%", left: "90%", transform: "translate(-50%, -50%)" },
      { top: "48%", left: "98%", transform: "translate(-50%, -50%)" },
      { top: "78%", left: "88%", transform: "translate(-50%, -50%)" },
    ],
    10: [
      { top: "87%", left: "50%", transform: "translate(-50%, -50%)" },
      { top: "78%", left: "10%", transform: "translate(-50%, -50%)" },
      { top: "48%", left: "2%", transform: "translate(-50%, -50%)" },
      { top: "18%", left: "8%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "30%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "55%", transform: "translate(-50%, -50%)" },
      { top: "6%", left: "80%", transform: "translate(-50%, -50%)" },
      { top: "18%", left: "92%", transform: "translate(-50%, -50%)" },
      { top: "48%", left: "98%", transform: "translate(-50%, -50%)" },
      { top: "78%", left: "90%", transform: "translate(-50%, -50%)" },
    ],
  };

  if (layouts[maxPlayers]) {
    return layouts[maxPlayers];
  }

  // Fallback: distribute around an ellipse
  const positions: SeatPosition[] = [];
  for (let i = 0; i < maxPlayers; i++) {
    const angle = (270 + (360 / maxPlayers) * i) * (Math.PI / 180);
    const rx = 46;
    const ry = 42;
    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);
    positions.push({
      top: `${y}%`,
      left: `${x}%`,
      transform: "translate(-50%, -50%)",
    });
  }
  return positions;
}

export function PokerTable({
  table,
  myPlayerId,
  myHoleCards,
  timeRemaining,
  startGameButton,
  onSeatClick,
}: PokerTableProps) {
  const hand = table.currentHand;
  const dealerIndex = hand?.dealerIndex ?? -1;
  const activePlayerIndex = hand?.activePlayerIndex ?? -1;

  // Get seat positions
  const seatPositions = getSeatPositions(table.maxPlayers);

  // Determine small/big blind seats from hand
  const smallBlindPlayerId = hand?.smallBlindPlayerId;
  const bigBlindPlayerId = hand?.bigBlindPlayerId;

  // Blinds display string
  const blindsLabel = `NLH ~ ${table.smallBlind} / ${table.bigBlind}`;

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {/* Dark background underneath */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #1a2a1a 0%, #111 60%, #0a0a0a 100%)",
        }}
      />

      {/* Blinds info — top right like PokerNow */}
      <div className="absolute top-3 right-4 z-30">
        <span className="text-white/60 text-xs sm:text-sm font-semibold tracking-wide">
          {blindsLabel}
        </span>
      </div>

      {/* Hand counter - top left */}
      {table.handCount > 0 && (
        <div className="absolute top-3 left-4 z-30">
          <span className="text-white/40 text-[10px] sm:text-xs font-mono">
            Hand #{table.handCount}
          </span>
        </div>
      )}

      {/* ===== TABLE FELT ===== */}
      <div
        className="absolute rounded-[50%] border-[7px]"
        style={{
          top: "16%",
          left: "10%",
          right: "10%",
          bottom: "18%",
          backgroundColor: "#1b6b3a",
          borderColor: "#6b3a1b",
          boxShadow:
            "inset 0 0 60px rgba(0,0,0,0.5), inset 0 0 120px rgba(0,0,0,0.2), 0 12px 40px rgba(0,0,0,0.5), 0 0 0 3px #4a2810",
        }}
      >
        {/* Wood rail highlight */}
        <div
          className="absolute -inset-[7px] rounded-[50%] pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(139,69,19,0.4) 0%, rgba(90,45,12,0.1) 30%, rgba(139,69,19,0.3) 100%)",
            borderRadius: "50%",
          }}
        />

        {/* Inner felt border line */}
        <div
          className="absolute inset-3 sm:inset-5 rounded-[50%] border border-white/[0.07] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, #1f7a44 0%, #1b6b3a 50%, #166030 100%)",
          }}
        />

        {/* Center content area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          {/* Pot display */}
          {hand && hand.pot > 0 && (
            <PotDisplay pot={hand.pot} sidePots={hand.sidePots} />
          )}

          {/* Community cards */}
          {hand && hand.communityCards && hand.communityCards.length > 0 && (
            <CommunityCards cards={hand.communityCards} stage={hand.stage} />
          )}

          {/* Waiting state when no hand is active */}
          {!hand && (
            <div className="flex flex-col items-center gap-3">
              <div className="text-white/30 text-sm font-medium">
                Waiting for players…
              </div>
              {/* Branding like PokerNow */}
              <div className="text-white/[0.07] text-lg sm:text-xl font-bold tracking-[0.15em] uppercase select-none">
                OctWa Poker
              </div>
            </div>
          )}

          {/* Stage indicator during hand */}
          {hand && !hand.communityCards?.length && (
            <div className="text-white/40 text-[10px] sm:text-xs uppercase tracking-[0.2em] font-medium">
              {hand.stage}
            </div>
          )}
        </div>

        {/* Center branding watermark (visible during play) */}
        {hand && (
          <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 z-[5] pointer-events-none">
            <div className="text-white/[0.05] text-xs sm:text-sm font-bold tracking-[0.15em] uppercase select-none whitespace-nowrap">
              POWERED BY OCTWA POKER
            </div>
          </div>
        )}
      </div>

      {/* ===== PLAYER SEATS ===== */}
      {table.players.map((player, index) => {
        const position = seatPositions[index];
        if (!position) return null;

        const isMe = player?.id === myPlayerId;
        const isCurrentTurn = index === activePlayerIndex;
        const isDealerSeat = index === dealerIndex;
        const isOwner = player?.address === table.creatorAddress;
        const isSmallBlind = player?.id === smallBlindPlayerId;
        const isBigBlind = player?.id === bigBlindPlayerId;

        const posLeft = parseFloat(position.left);
        const posTop = parseFloat(position.top);
        const isRightSide = posLeft > 70;
        const isLeftSide = posLeft < 30;
        const isBottomSide = posTop > 70;

        // Determine which hole cards to show
        const holeCards = isMe ? myHoleCards : player?.holeCards;
        const showCards = isMe || hand?.stage === "showdown";

        return (
          <div key={index} className="absolute z-20" style={position}>
            <PlayerSeat
              player={player}
              seatIndex={index}
              isCurrentTurn={isCurrentTurn}
              isDealer={isDealerSeat}
              isMe={isMe}
              holeCards={holeCards}
              showCards={showCards}
              timeRemaining={isCurrentTurn ? timeRemaining : undefined}
              onSeatClick={onSeatClick}
              isSmallBlind={isSmallBlind}
              isBigBlind={isBigBlind}
            />

            {/* Start Game Button — positioned near the owner's seat */}
            {isOwner && startGameButton && (
              <div
                className={`
                  absolute whitespace-nowrap z-30
                  ${
                    isRightSide
                      ? "right-full mr-3"
                      : isLeftSide
                        ? "left-full ml-3"
                        : "top-full mt-3 left-1/2 -translate-x-1/2"
                  }
                  ${
                    isBottomSide && !isLeftSide && !isRightSide
                      ? "bottom-full mb-16 top-auto mt-0"
                      : ""
                  }
                `}
                style={{
                  top: isLeftSide || isRightSide ? "50%" : undefined,
                  transform:
                    isLeftSide || isRightSide ? "translateY(-50%)" : undefined,
                }}
              >
                {startGameButton}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
