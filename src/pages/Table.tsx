import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { useSocket } from "@/hooks/useSocket";
import {
  PokerTable,
  ActionPanel,
  Leaderboard,
  LiveChat,
} from "@/components/table";
import { TournamentOverlay } from "@/components/tournament";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Loader2,
  Trophy,
  XCircle,
  AlertTriangle,
  Settings,
  Copy,
  Check,
  Users,
} from "lucide-react";
import type { AvailableActions } from "@/types/game";
import { BettingManager } from "@/game/BettingManager";

// Hand result notification
interface HandResultNotification {
  isWinner: boolean;
  amount: number;
  handName?: string;
}

export function Table() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // Store
  const {
    currentTable,
    currentHand,
    myHoleCards,
    connection,
    socketConnected,
    errors,
    clearError,
    chatMessages,
    logEntries,
    isOnWaitlist,
    currentTournament,
  } = useStore();

  // Socket
  const {
    leaveTable,
    sendAction,
    isReconnecting,
    rejoinTable,
    lastHandResult,
    clearLastHandResult,
    startGame,
    sendChatMessage,
    joinWaitlist,
  } = useSocket();

  // Local state
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [handResult, setHandResult] = useState<HandResultNotification | null>(
    null,
  );
  const [bustedMessage, setBustedMessage] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Find my player
  const myPlayer = currentTable?.players.find(
    (p) => p?.address === connection?.walletPubKey,
  );

  const isOwner =
    connection?.walletPubKey &&
    currentTable?.creatorAddress === connection.walletPubKey;

  const canStartGame =
    isOwner &&
    !currentHand &&
    (currentTable?.players.filter((p) => p !== null && p.isConnected).length ??
      0) >= 2;

  const isSpectator = !myPlayer && !!currentTable;

  const playerCount =
    currentTable?.players.filter((p) => p !== null).length ?? 0;

  const handleStartGame = async () => {
    if (!tableId || !connection?.walletPubKey) return;
    setIsStarting(true);
    try {
      startGame(tableId, connection.walletPubKey);
    } finally {
      // Reset after a short delay to allow animation
      setTimeout(() => setIsStarting(false), 500);
    }
  };

  // Copy table invite link
  const handleCopyLink = useCallback(() => {
    if (!tableId) return;
    const url = `${window.location.origin}/table/${tableId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [tableId]);

  // Handle player busted error
  useEffect(() => {
    const bustedError = errors.find((e) => e.code === "PLAYER_BUSTED");
    if (bustedError) {
      setBustedMessage(bustedError.message);
      clearError("PLAYER_BUSTED");

      const timeout = setTimeout(() => {
        setBustedMessage(null);
        navigate("/lobby");
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [errors, clearError, navigate]);

  // Redirect if we're no longer in the table (kicked)
  useEffect(() => {
    if (
      currentTable &&
      !myPlayer &&
      !isLoading &&
      !bustedMessage &&
      !isSpectator
    ) {
      // If we expected to be seated but aren't, go back
      // Only do this if we had a session but lost it
    }
  }, [currentTable, myPlayer, isLoading, bustedMessage, isSpectator]);

  // Handle hand result notification
  useEffect(() => {
    if (!lastHandResult || !myPlayer) return;

    const myWin = lastHandResult.winners.find(
      (w) => w.playerId === myPlayer.id,
    );

    if (myWin) {
      setHandResult({
        isWinner: true,
        amount: myWin.amount,
        handName: myWin.hand?.name,
      });
    } else {
      setHandResult({
        isWinner: false,
        amount: 0,
      });
    }

    const timeout = setTimeout(() => {
      setHandResult(null);
      clearLastHandResult();
    }, 4000);

    return () => clearTimeout(timeout);
  }, [lastHandResult, myPlayer, clearLastHandResult]);

  // Auto-rejoin on page load if we have session
  useEffect(() => {
    if (
      socketConnected &&
      tableId &&
      connection?.walletPubKey &&
      !currentTable
    ) {
      console.log("[Table] Attempting rejoin for table:", tableId);
      rejoinTable(tableId, connection.walletPubKey);

      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [
    socketConnected,
    tableId,
    connection?.walletPubKey,
    currentTable,
    rejoinTable,
  ]);

  // Clear loading when table is received
  useEffect(() => {
    if (currentTable) {
      setIsLoading(false);
    }
  }, [currentTable]);

  const isMyTurn =
    currentTable?.currentHand?.activePlayerIndex !== undefined &&
    currentTable.players[currentTable.currentHand.activePlayerIndex]?.id ===
      myPlayer?.id;

  // Calculate available actions
  const getAvailableActions = (): AvailableActions => {
    if (!currentTable || !currentHand || !myPlayer || !isMyTurn) {
      return {
        canFold: false,
        canCheck: false,
        canCall: false,
        canBet: false,
        canRaise: false,
        canAllIn: false,
        callAmount: 0,
        minBet: 0,
        minRaise: 0,
        maxRaise: 0,
      };
    }

    const playerState = {
      playerId: myPlayer.id,
      stack: myPlayer.stack,
      currentBet: myPlayer.bet,
      totalBetThisRound: myPlayer.bet,
      hasActed: false,
      isFolded: myPlayer.status === "folded",
      isAllIn: myPlayer.status === "all-in",
    };

    const bettingState = {
      players: currentTable.players
        .filter((p) => p !== null)
        .map((p) => ({
          playerId: p!.id,
          stack: p!.stack,
          currentBet: p!.bet,
          totalBetThisRound: p!.bet,
          hasActed: false,
          isFolded: p!.status === "folded",
          isAllIn: p!.status === "all-in",
        })),
      currentBet: currentHand.currentBet,
      minRaise: currentTable.bigBlind,
      bigBlind: currentTable.bigBlind,
      pot: currentHand.pot,
      lastRaiseAmount: currentTable.bigBlind,
    };

    return BettingManager.getValidActions(playerState, bettingState);
  };

  // Turn timer
  useEffect(() => {
    if (!isMyTurn) {
      setTimeRemaining(30);
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (tableId) {
            sendAction(tableId, "fold");
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isMyTurn, tableId, sendAction]);

  const handleAction = (action: string, amount?: number) => {
    if (tableId) {
      sendAction(tableId, action, amount);
    }
  };

  const handleLeave = () => {
    if (tableId) {
      leaveTable(tableId);
    }
    navigate("/lobby");
  };

  const handleSendChat = useCallback(
    (content: string) => {
      if (tableId) {
        sendChatMessage(tableId, content);
      }
    },
    [tableId, sendChatMessage],
  );

  const handleJoinWaitlist = useCallback(() => {
    if (tableId) {
      joinWaitlist(tableId);
    }
  }, [tableId, joinWaitlist]);

  const handleSeatClick = useCallback((seatIndex: number) => {
    // If spectator clicking an empty seat, could trigger buy-in flow
    // For now just log it. In a full implementation this would open the BuyInDialog
    console.log("[Table] Seat clicked:", seatIndex);
  }, []);

  // ======================================================================
  // Loading states
  // ======================================================================

  if (!currentTable && isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted mb-2">Connecting to table...</p>
          <p className="text-muted/50 text-xs">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (!currentTable && !isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/50 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Table Not Found
          </h2>
          <p className="text-muted mb-6 text-sm">
            This table may have been removed or your session expired.
          </p>
          <Button variant="secondary" onClick={() => navigate("/lobby")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  // Guard
  if (!currentTable) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted mb-4">Table not found</p>
          <Button variant="secondary" onClick={() => navigate("/lobby")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  // ======================================================================
  // Main render
  // ======================================================================

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* ================================================================ */}
      {/* OVERLAY: Busted */}
      {/* ================================================================ */}
      {bustedMessage && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center animate-in fade-in duration-300">
          <div className="p-8 rounded-2xl text-center bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500 max-w-sm mx-4 shadow-2xl shadow-red-500/20">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-2xl font-bold text-red-400 mb-2">
              Out of Chips!
            </h2>
            <p className="text-muted mb-4">{bustedMessage}</p>
            <p className="text-sm text-muted/50">Redirecting to lobby...</p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* OVERLAY: Hand Result */}
      {/* ================================================================ */}
      {handResult && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center animate-in fade-in duration-300">
          <div
            className={`
              p-8 rounded-2xl text-center transform animate-in zoom-in duration-300
              max-w-sm mx-4 shadow-2xl
              ${
                handResult.isWinner
                  ? "bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500 shadow-yellow-500/20"
                  : "bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/50 shadow-red-500/10"
              }
            `}
          >
            {handResult.isWinner ? (
              <>
                <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400 drop-shadow-lg" />
                <h2 className="text-3xl font-bold text-yellow-400 mb-2">
                  YOU WIN!
                </h2>
                <p className="text-2xl text-foreground font-semibold tabular-nums">
                  +{handResult.amount.toLocaleString()} OCT
                </p>
                {handResult.handName && (
                  <p className="text-sm text-muted mt-2">
                    {handResult.handName}
                  </p>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <h2 className="text-2xl font-bold text-red-400 mb-2">
                  Better luck next time
                </h2>
                <p className="text-sm text-muted">Hand complete</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* OVERLAY: Reconnecting */}
      {/* ================================================================ */}
      {isReconnecting && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-gray-900/90 border border-gray-700 p-6 rounded-xl text-center shadow-2xl">
            <WifiOff className="w-8 h-8 mx-auto mb-2 text-yellow-500 animate-pulse" />
            <p className="text-foreground font-medium">Reconnecting...</p>
            <p className="text-muted text-xs mt-1">
              Please wait while we restore your session
            </p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* OPTIONS MENU (slide out) */}
      {/* ================================================================ */}
      {showOptions && (
        <div className="absolute inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowOptions(false)}
          />
          {/* Side panel */}
          <div className="relative z-50 w-64 bg-gray-900 border-r border-gray-700 h-full p-4 flex flex-col gap-3 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Options
              </h3>
              <button
                onClick={() => setShowOptions(false)}
                className="p-1 text-muted hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copiedLink ? "Link Copied!" : "Copy Table Link"}
            </button>

            <button
              onClick={() => {
                setShowLeaderboard(true);
                setShowOptions(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Trophy className="w-4 h-4 text-yellow-500" />
              Leaderboard
            </button>

            <div className="flex-1" />

            <button
              onClick={() => {
                setShowOptions(false);
                handleLeave();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Leave Table
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TOP HEADER BAR */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/80 bg-gray-900/80 backdrop-blur-sm shrink-0 z-30">
        <div className="flex items-center gap-2">
          {/* Options / hamburger */}
          <button
            onClick={() => setShowOptions(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Options"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Table name + blinds */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">
              {currentTable.name}
            </span>
            <span className="text-[10px] text-gray-500 bg-gray-800/60 px-1.5 py-0.5 rounded">
              {currentTable.smallBlind}/{currentTable.bigBlind}
            </span>
            {currentTable.mode === "tournament" && (
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-medium">
                MTT
              </span>
            )}
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-1">
            {socketConnected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500 animate-pulse" />
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Player count */}
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Users className="w-3 h-3" />
            <span>
              {playerCount}/{currentTable.maxPlayers}
            </span>
          </div>

          {/* Leaderboard quick access */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLeaderboard(true)}
            className="h-8 px-2"
            title="Leaderboard"
          >
            <Trophy className="w-4 h-4 text-yellow-500" />
          </Button>

          {/* My stack */}
          {myPlayer && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border border-yellow-300/40 shadow-sm" />
              <span className="font-bold text-foreground text-sm tabular-nums">
                {myPlayer.stack.toLocaleString()}
              </span>
            </div>
          )}

          {/* Leave button (visible on wider screens) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 hidden sm:flex"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* LEADERBOARD MODAL */}
      {/* ================================================================ */}
      <Leaderboard
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      {/* ================================================================ */}
      {/* TABLE AREA — fills remaining vertical space */}
      {/* ================================================================ */}
      <div
        className="flex-1 relative min-h-0"
        style={{
          // Leave room for the bottom bar (collapsed ~40px, action panel ~80px)
          paddingBottom: isMyTurn ? "120px" : "44px",
        }}
      >
        <PokerTable
          table={currentTable}
          myPlayerId={myPlayer?.id}
          myHoleCards={myHoleCards}
          timeRemaining={isMyTurn ? timeRemaining : undefined}
          onSeatClick={handleSeatClick}
          startGameButton={
            canStartGame ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartGame}
                disabled={isStarting}
                className="
                  h-8 px-4 text-xs font-bold
                  bg-green-600 hover:bg-green-500
                  shadow-lg shadow-green-600/30
                  border border-green-400/30
                  transition-all duration-200
                "
              >
                {isStarting ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                ) : null}
                {isStarting ? "Starting..." : "▶ Start Game"}
              </Button>
            ) : undefined
          }
        />

        {/* Tournament HUD overlay */}
        {currentTable.mode === "tournament" &&
          currentTournament &&
          currentTournament.id === currentTable.tournamentId && (
            <TournamentOverlay
              tournament={currentTournament}
              onNavigateToLobby={() =>
                navigate(`/tournament/${currentTable.tournamentId}`)
              }
            />
          )}
      </div>

      {/* ================================================================ */}
      {/* ACTION PANEL — fixed above the chat bar when it's your turn */}
      {/* ================================================================ */}
      {isMyTurn && (
        <div
          className="
            fixed left-0 right-0 z-30
            px-3 py-2
            border-t border-gray-700/50
            bg-gray-900/95 backdrop-blur-md
          "
          style={{
            // Sits above the collapsed chat bar (~40px from bottom)
            bottom: "40px",
          }}
        >
          <ActionPanel
            actions={getAvailableActions()}
            onAction={handleAction}
          />
        </div>
      )}

      {/* ================================================================ */}
      {/* LIVE CHAT BAR — always at the very bottom */}
      {/* ================================================================ */}
      <LiveChat
        messages={chatMessages}
        logEntries={logEntries}
        onSendMessage={handleSendChat}
        onJoinWaitlist={isSpectator ? handleJoinWaitlist : undefined}
        waitlistCount={currentTable.waitlistCount ?? 0}
        isOnWaitlist={isOnWaitlist}
        myPlayerId={myPlayer?.id}
        playerCount={playerCount}
        maxPlayers={currentTable.maxPlayers}
        isSpectator={isSpectator}
      />
    </div>
  );
}
