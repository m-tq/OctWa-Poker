import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useSocket } from '@/hooks/useSocket';
import { PokerTable, ActionPanel, Leaderboard } from '@/components/table';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Wifi, WifiOff, Loader2, Trophy, XCircle, AlertTriangle } from 'lucide-react';
import type { AvailableActions } from '@/types/game';
import { BettingManager } from '@/game/BettingManager';

// Hand result notification
interface HandResultNotification {
  isWinner: boolean;
  amount: number;
  handName?: string;
}

export function Table() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { currentTable, currentHand, myHoleCards, connection, socketConnected, errors, clearError } = useStore();
  const { leaveTable, sendAction, isReconnecting, rejoinTable, lastHandResult, clearLastHandResult, startGame } = useSocket();
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [handResult, setHandResult] = useState<HandResultNotification | null>(null);
  const [bustedMessage, setBustedMessage] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Find my player
  const myPlayer = currentTable?.players.find(p => 
    p?.address === connection?.walletPubKey
  );

  const isOwner = connection?.walletPubKey && currentTable?.creatorAddress === connection.walletPubKey;
  const canStartGame = isOwner && !currentHand && currentTable?.players.filter(p => p !== null && p.isConnected).length >= 2;

  const handleStartGame = async () => {
    if (!tableId || !connection?.walletPubKey) return;
    setIsStarting(true);
    try {
      startGame(tableId, connection.walletPubKey);
    } finally {
      setIsStarting(false);
    }
  };

  // Handle player busted error
  useEffect(() => {
    const bustedError = errors.find(e => e.code === 'PLAYER_BUSTED');
    if (bustedError) {
      setBustedMessage(bustedError.message);
      clearError('PLAYER_BUSTED');
      
      // Redirect to lobby after 3 seconds
      const timeout = setTimeout(() => {
        setBustedMessage(null);
        navigate('/lobby');
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [errors, clearError, navigate]);

  // Also redirect if we're no longer in the table (kicked)
  useEffect(() => {
    // If we had a table but now don't have myPlayer, we were kicked
    if (currentTable && !myPlayer && !isLoading && !bustedMessage) {
      console.log('[Table] Player no longer in table, redirecting to lobby');
      navigate('/lobby');
    }
  }, [currentTable, myPlayer, isLoading, bustedMessage, navigate]);

  // Handle hand result notification
  useEffect(() => {
    if (!lastHandResult || !myPlayer) return;

    // Check if I won
    const myWin = lastHandResult.winners.find(w => w.playerId === myPlayer.id);
    
    if (myWin) {
      setHandResult({
        isWinner: true,
        amount: myWin.amount,
        handName: myWin.hand?.name,
      });
    } else {
      // I lost or folded
      setHandResult({
        isWinner: false,
        amount: 0,
      });
    }

    // Clear notification after 4 seconds
    const timeout = setTimeout(() => {
      setHandResult(null);
      clearLastHandResult();
    }, 4000);

    return () => clearTimeout(timeout);
  }, [lastHandResult, myPlayer, clearLastHandResult]);

  // Auto-rejoin on page load if we have session
  useEffect(() => {
    if (socketConnected && tableId && connection?.walletPubKey && !currentTable) {
      console.log('[Table] Attempting rejoin for table:', tableId);
      rejoinTable(tableId, connection.walletPubKey);
      
      // Set timeout for loading
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [socketConnected, tableId, connection?.walletPubKey, currentTable, rejoinTable]);

  // Clear loading when table is received
  useEffect(() => {
    if (currentTable) {
      setIsLoading(false);
    }
  }, [currentTable]);

  const isMyTurn = currentTable?.currentHand?.activePlayerIndex !== undefined &&
    currentTable.players[currentTable.currentHand.activePlayerIndex]?.id === myPlayer?.id;

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
      isFolded: myPlayer.status === 'folded',
      isAllIn: myPlayer.status === 'all-in',
    };

    const bettingState = {
      players: currentTable.players.filter(p => p !== null).map(p => ({
        playerId: p!.id,
        stack: p!.stack,
        currentBet: p!.bet,
        totalBetThisRound: p!.bet,
        hasActed: false,
        isFolded: p!.status === 'folded',
        isAllIn: p!.status === 'all-in',
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
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-fold on timeout
          if (tableId) {
            sendAction(tableId, 'fold');
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
    navigate('/lobby');
  };

  // Loading state
  if (!currentTable && isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted mb-4">Connecting to table...</p>
        </div>
      </div>
    );
  }

  // Table not found
  if (!currentTable && !isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted mb-4">Table not found or session expired</p>
          <Button variant="secondary" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  // Guard against null currentTable after loading check
  if (!currentTable) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted mb-4">Table not found</p>
          <Button variant="secondary" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Busted Notification */}
      {bustedMessage && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center animate-in fade-in duration-300">
          <div className="p-8 rounded-xl text-center bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-2xl font-bold text-red-400 mb-2">Out of Chips!</h2>
            <p className="text-muted mb-4">{bustedMessage}</p>
            <p className="text-sm text-muted">Redirecting to lobby...</p>
          </div>
        </div>
      )}

      {/* Hand Result Notification */}
      {handResult && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center animate-in fade-in duration-300">
          <div className={`
            p-8 rounded-xl text-center transform animate-in zoom-in duration-300
            ${handResult.isWinner 
              ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500' 
              : 'bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/50'
            }
          `}>
            {handResult.isWinner ? (
              <>
                <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                <h2 className="text-3xl font-bold text-yellow-400 mb-2">YOU WIN!</h2>
                <p className="text-2xl text-foreground font-semibold">
                  +{handResult.amount.toLocaleString()} OCT
                </p>
                {handResult.handName && (
                  <p className="text-sm text-muted mt-2">{handResult.handName}</p>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <h2 className="text-2xl font-bold text-red-400 mb-2">Better luck next time</h2>
                <p className="text-sm text-muted">Hand complete</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reconnecting overlay */}
      {isReconnecting && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-secondary p-6 rounded-lg text-center">
            <WifiOff className="w-8 h-8 mx-auto mb-2 text-yellow-500 animate-pulse" />
            <p className="text-foreground">Reconnecting...</p>
          </div>
        </div>
      )}

      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleLeave} className="h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground text-sm">{currentTable.name}</span>
            <span className="text-xs text-muted">
              {currentTable.smallBlind}/{currentTable.bigBlind}
            </span>
            {socketConnected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            {canStartGame && (
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleStartGame} 
                disabled={isStarting}
                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 ml-2"
              >
                {isStarting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Start Game
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowLeaderboard(true)}
            className="h-8 px-2"
            title="Leaderboard"
          >
            <Trophy className="w-4 h-4 text-yellow-500" />
          </Button>
          {myPlayer && (
            <span className="font-bold text-foreground text-sm">{myPlayer.stack.toLocaleString()} OCT</span>
          )}
        </div>
      </div>

      {/* Leaderboard Modal */}
      <Leaderboard open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

      {/* Table - fills remaining space */}
      <div className="flex-1 relative min-h-0">
        <PokerTable
          table={currentTable}
          myPlayerId={myPlayer?.id}
          myHoleCards={myHoleCards}
          timeRemaining={isMyTurn ? timeRemaining : undefined}
        />
      </div>

      {/* Action panel - fixed at bottom */}
      {isMyTurn && (
        <div className="px-3 py-2 border-t border-border bg-secondary/50 shrink-0">
          <ActionPanel
            actions={getAvailableActions()}
            onAction={handleAction}
          />
        </div>
      )}
    </div>
  );
}
