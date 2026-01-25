import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft,
  User,
  Trophy,
  TrendingUp,
  Wallet,
  History,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Gift,
  ExternalLink,
} from 'lucide-react';
import { API_URL, OCTRA_EXPLORER } from '@/config';

// Username validation
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,16}$/;

// Game Wallet types
interface ClaimableWinning {
  fromSessionId: string;
  fromAddress: string;
  amount: number;
  claimed: boolean;
  claimTxHash?: string;
  claimedAt?: number;
}

interface GameWalletInfo {
  sessionId: string;
  gameWalletAddress: string;
  tableId: string;
  buyInAmount: number;
  currentStack: number;
  status: 'PENDING' | 'CONFIRMED' | 'PLAYING' | 'SETTLING' | 'COMPLETED' | 'REFUNDED' | 'EXPIRED';
  claimableWinnings: ClaimableWinning[];
  historyWinnings?: ClaimableWinning[];
  settlementTxHash?: string;
  settledAt?: number;
  withdrawableAmount: number;
  createdAt: number;
}

interface HandHistoryItem {
  id: string;
  handNumber: number;
  pot: number;
  communityCards: string;
  winnersJson: string;
  startedAt: string;
  endedAt: string;
}

interface HandPlayerDetail {
  odId: string;
  oduserId: string;
  seatIndex: number;
  holeCards: string | null;
  startingStack: number;
  endingStack: number;
  totalBet: number;
  won: number;
  finalHand: string | null;
  result: 'won' | 'lost' | 'folded' | 'split';
  userAddress: string | null;
  userName: string;
}

interface HandDetail {
  hand: HandHistoryItem;
  players: HandPlayerDetail[];
}

export function Dashboard() {
  const navigate = useNavigate();
  const { connection, username, setUsername, userStats, setUserStats } = useStore();

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(username || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  const [handHistory, setHandHistory] = useState<HandHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [expandedHand, setExpandedHand] = useState<string | null>(null);
  const [handDetails, setHandDetails] = useState<Record<string, HandDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  // Game Wallet state
  const [gameWallets, setGameWallets] = useState<GameWalletInfo[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [withdrawingSession, setWithdrawingSession] = useState<string | null>(null);
  const [claimingSession, setClaimingSession] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSuccess, setWalletSuccess] = useState<string | null>(null);

  // Fetch user stats
  useEffect(() => {
    if (!connection?.walletPubKey) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const response = await fetch(`${API_URL}/api/users/${connection.walletPubKey}/stats`);
        if (response.ok) {
          const data = await response.json();
          setUserStats(data);
          if (data.name && !username) {
            setUsername(data.name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [connection?.walletPubKey, setUserStats, setUsername, username]);

  // Fetch hand history
  useEffect(() => {
    if (!connection?.walletPubKey) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch(
          `${API_URL}/api/users/${connection.walletPubKey}/history?limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          setHandHistory(data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [connection?.walletPubKey]);

  // Fetch game wallets
  useEffect(() => {
    if (!connection?.walletPubKey) return;
    fetchGameWallets();
  }, [connection?.walletPubKey]);

  const fetchGameWallets = async () => {
    if (!connection?.walletPubKey) return;
    
    setLoadingWallets(true);
    try {
      const response = await fetch(`${API_URL}/api/game-wallet/player/${connection.walletPubKey}`);
      if (response.ok) {
        const data = await response.json();
        setGameWallets(data);
      }
    } catch (err) {
      console.error('Failed to fetch game wallets:', err);
    } finally {
      setLoadingWallets(false);
    }
  };

  // Withdraw from game wallet
  const handleWithdraw = async (sessionId: string) => {
    if (!connection?.walletPubKey) return;

    setWithdrawingSession(sessionId);
    setWalletError(null);
    setWalletSuccess(null);

    try {
      const response = await fetch(`${API_URL}/api/game-wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerAddress: connection.walletPubKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      setWalletSuccess(`Withdrawal successful! TX: ${data.txHash?.slice(0, 16)}...`);
      fetchGameWallets(); // Refresh
    } catch (err) {
      setWalletError((err as Error).message);
    } finally {
      setWithdrawingSession(null);
    }
  };

  // Claim winnings from another player's game wallet
  const handleClaim = async (winnerSessionId: string, loserSessionId: string) => {
    if (!connection?.walletPubKey) return;

    setClaimingSession(`${winnerSessionId}-${loserSessionId}`);
    setWalletError(null);
    setWalletSuccess(null);

    try {
      const response = await fetch(`${API_URL}/api/game-wallet/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: winnerSessionId,
          fromSessionId: loserSessionId,
          playerAddress: connection.walletPubKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Claim failed');
      }

      setWalletSuccess(`Winnings claimed! TX: ${data.txHash?.slice(0, 16)}...`);
      fetchGameWallets(); // Refresh
    } catch (err) {
      setWalletError((err as Error).message);
    } finally {
      setClaimingSession(null);
    }
  };

  // Fetch hand details when expanded
  const toggleHandDetails = async (handId: string) => {
    if (expandedHand === handId) {
      setExpandedHand(null);
      return;
    }

    setExpandedHand(handId);

    if (handDetails[handId]) return; // Already loaded

    setLoadingDetails(handId);
    try {
      const response = await fetch(`${API_URL}/api/hands/${handId}`);
      if (response.ok) {
        const data = await response.json();
        setHandDetails((prev) => ({ ...prev, [handId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch hand details:', err);
    } finally {
      setLoadingDetails(null);
    }
  };

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 16) return 'Username must be at most 16 characters';
    if (!USERNAME_REGEX.test(value)) return 'Only letters and numbers allowed';
    return null;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewUsername(value);
    setUsernameError(value ? validateUsername(value) : null);
  };

  const handleSaveUsername = async () => {
    const error = validateUsername(newUsername);
    if (error) {
      setUsernameError(error);
      return;
    }

    if (!connection?.walletPubKey) return;

    setSavingUsername(true);
    try {
      const response = await fetch(`${API_URL}/api/users/update-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: connection.walletPubKey,
          name: newUsername,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update username');
      }

      setUsername(newUsername);
      setIsEditingUsername(false);
    } catch (err) {
      setUsernameError((err as Error).message);
    } finally {
      setSavingUsername(false);
    }
  };

  const cancelEditUsername = () => {
    setNewUsername(username || '');
    setUsernameError(null);
    setIsEditingUsername(false);
  };

  // Format card for display
  const formatCard = (card: string) => {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    const suitSymbol: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
    const suitColor: Record<string, string> = {
      H: 'text-red-500',
      D: 'text-red-500',
      C: 'text-foreground',
      S: 'text-foreground',
    };
    return (
      <span className={suitColor[suit]}>
        {rank}
        {suitSymbol[suit]}
      </span>
    );
  };

  if (!connection) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted mb-4">Please connect your wallet to view dashboard</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      {/* Profile Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              {isEditingUsername ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={handleUsernameChange}
                    className={`
                      px-3 py-1 rounded border bg-secondary text-foreground text-lg font-semibold
                      ${usernameError ? 'border-red-500' : 'border-border'}
                    `}
                    maxLength={16}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveUsername}
                    disabled={!!usernameError || savingUsername}
                    loading={savingUsername}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditUsername}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    {username || 'Anonymous'}
                  </h2>
                  <button
                    onClick={() => setIsEditingUsername(true)}
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {usernameError && isEditingUsername && (
                <div className="flex items-center gap-1 text-red-400 text-sm mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {usernameError}
                </div>
              )}
              <p className="text-sm text-muted mt-1">
                {connection.walletPubKey.slice(0, 8)}...{connection.walletPubKey.slice(-6)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<History className="w-5 h-5" />}
          label="Hands Played"
          value={loadingStats ? '...' : userStats?.handsPlayed?.toString() || '0'}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5 text-yellow-500" />}
          label="Hands Won"
          value={loadingStats ? '...' : userStats?.handsWon?.toString() || '0'}
          subValue={loadingStats ? '' : `${userStats?.winRate || '0'}% win rate`}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          label="Total Winnings"
          value={loadingStats ? '...' : `${userStats?.totalWinnings?.toLocaleString() || '0'} OCT`}
          valueColor="text-green-400"
        />
        <StatCard
          icon={<Wallet className="w-5 h-5 text-primary" />}
          label="Net Profit"
          value={
            loadingStats
              ? '...'
              : `${(userStats?.netProfit || 0) >= 0 ? '+' : ''}${userStats?.netProfit?.toLocaleString() || '0'} OCT`
          }
          valueColor={(userStats?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Game Wallets Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Game Wallets
        </h3>

        {/* Success/Error Messages */}
        {walletSuccess && (
          <div className="mb-4 p-3 rounded bg-green-500/20 border border-green-500/30 text-green-400 text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              {walletSuccess}
            </div>
            <button 
              onClick={() => setWalletSuccess(null)}
              className="hover:bg-green-500/20 p-1 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {walletError && (
          <div className="mb-4 p-3 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {walletError}
            </div>
            <button 
              onClick={() => setWalletError(null)}
              className="hover:bg-red-500/20 p-1 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadingWallets ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : gameWallets.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p>No game wallets found</p>
            <p className="text-xs mt-2">Game wallets are created when you buy-in to a table</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gameWallets.map((wallet) => {
              const isActive = wallet.status === 'PLAYING' || wallet.status === 'CONFIRMED';
              const canWithdraw = wallet.status === 'COMPLETED' || isActive;
              const hasWithdrawable = wallet.withdrawableAmount > 0;
              const hasClaimable = wallet.claimableWinnings.length > 0;
              const totalClaimable = wallet.claimableWinnings.reduce((sum, w) => sum + w.amount, 0);

              return (
                <div
                  key={wallet.sessionId}
                  className={`p-4 rounded-lg border ${
                    isActive ? 'bg-primary/5 border-primary/30' : 'bg-secondary/50 border-border'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isActive
                            ? 'bg-green-500/20 text-green-400'
                            : wallet.status === 'COMPLETED'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {wallet.status}
                      </span>
                      <span className="text-sm text-muted">
                        Table: {wallet.tableId.slice(0, 8)}...
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(wallet.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Wallet Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                    <div>
                      <p className="text-xs text-muted">Buy-in</p>
                      <p className="font-medium">{wallet.buyInAmount.toLocaleString()} OCT</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Current Stack</p>
                      <p className="font-medium">{wallet.currentStack.toLocaleString()} OCT</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Withdrawable</p>
                      <p className={`font-medium ${hasWithdrawable ? 'text-green-400' : ''}`}>
                        {wallet.withdrawableAmount.toLocaleString()} OCT
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Claimable Winnings</p>
                      <p className={`font-medium ${hasClaimable ? 'text-yellow-400' : ''}`}>
                        {totalClaimable.toLocaleString()} OCT
                      </p>
                    </div>
                  </div>

                  {/* Game Wallet Address */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="text-muted">Wallet:</span>
                    <code className="bg-secondary px-2 py-1 rounded">
                      {wallet.gameWalletAddress.slice(0, 12)}...{wallet.gameWalletAddress.slice(-8)}
                    </code>
                    <a
                      href={`${OCTRA_EXPLORER}/addresses/${wallet.gameWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {/* Withdraw Button */}
                    {hasWithdrawable && canWithdraw && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleWithdraw(wallet.sessionId)}
                        disabled={withdrawingSession === wallet.sessionId}
                        loading={withdrawingSession === wallet.sessionId}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Withdraw {wallet.withdrawableAmount.toLocaleString()} OCT
                      </Button>
                    )}

                    {/* Claim Buttons */}
                    {wallet.claimableWinnings.map((winning) => (
                      <Button
                        key={winning.fromSessionId}
                        size="sm"
                        variant="primary"
                        onClick={() => handleClaim(wallet.sessionId, winning.fromSessionId)}
                        disabled={claimingSession === `${wallet.sessionId}-${winning.fromSessionId}`}
                        loading={claimingSession === `${wallet.sessionId}-${winning.fromSessionId}`}
                      >
                        <Gift className="w-4 h-4 mr-1" />
                        Claim {winning.amount.toLocaleString()} OCT
                      </Button>
                    ))}

                    {!hasWithdrawable && !hasClaimable && canWithdraw && (
                      <span className="text-xs text-muted py-2">No actions available</span>
                    )}
                  </div>

                  {/* Transaction History */}
                  {(wallet.settlementTxHash || (wallet.historyWinnings && wallet.historyWinnings.length > 0)) && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-semibold text-muted mb-2 flex items-center gap-1">
                        <History className="w-3 h-3" />
                        Transaction History
                      </p>
                      <div className="space-y-2">
                        {wallet.settlementTxHash && (
                          <div className="flex items-center justify-between text-xs bg-secondary/30 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <Download className="w-3 h-3 text-blue-400" />
                              <span className="text-foreground">Withdrawal</span>
                              <span className="text-muted">
                                {wallet.settledAt ? new Date(wallet.settledAt).toLocaleString() : ''}
                              </span>
                            </div>
                            <a
                              href={`${OCTRA_EXPLORER}/txs/${wallet.settlementTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              {wallet.settlementTxHash.slice(0, 8)}...
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {wallet.historyWinnings?.map((w, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-secondary/30 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <Gift className="w-3 h-3 text-yellow-400" />
                              <span className="text-foreground">Claimed {w.amount.toLocaleString()} OCT</span>
                              <span className="text-muted">
                                {w.claimedAt ? new Date(w.claimedAt).toLocaleString() : ''}
                              </span>
                            </div>
                            {w.claimTxHash && (
                              <a
                                href={`${OCTRA_EXPLORER}/txs/${w.claimTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 flex items-center gap-1"
                              >
                                {w.claimTxHash.slice(0, 8)}...
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hand History */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Recent Hands
        </h3>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : handHistory.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p>No hands played yet</p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate('/lobby')}>
              Play Now
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {handHistory.map((hand) => {
              const winners = JSON.parse(hand.winnersJson || '[]');
              // Match by address field (stored in winnersJson)
              const myWin = winners.find((w: any) => w.address === connection.walletPubKey);
              const isWinner = !!myWin;
              const isExpanded = expandedHand === hand.id;
              const details = handDetails[hand.id];
              const communityCards = JSON.parse(hand.communityCards || '[]');

              return (
                <div key={hand.id} className="rounded-lg bg-secondary/50 overflow-hidden">
                  {/* Hand Summary Row */}
                  <button
                    onClick={() => toggleHandDetails(hand.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isWinner ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}
                      >
                        {isWinner ? (
                          <Trophy className="w-4 h-4 text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">Hand #{hand.handNumber}</p>
                        <p className="text-xs text-muted">
                          {new Date(hand.endedAt).toLocaleDateString()}{' '}
                          {new Date(hand.endedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={`font-semibold ${isWinner ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {isWinner ? `+${myWin.amount.toLocaleString()} OCT` : 'LOST'}
                        </p>
                        <p className="text-xs text-muted">Pot: {hand.pot.toLocaleString()} OCT</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/50">
                      {loadingDetails === hand.id ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted" />
                        </div>
                      ) : details ? (
                        <div className="pt-4 space-y-4">
                          {/* Community Cards */}
                          <div>
                            <p className="text-xs text-muted mb-2">Community Cards</p>
                            <div className="flex gap-2">
                              {communityCards.length > 0 ? (
                                communityCards.map((card: string, i: number) => (
                                  <div
                                    key={i}
                                    className="w-10 h-14 bg-white rounded flex items-center justify-center text-lg font-bold"
                                  >
                                    {formatCard(card)}
                                  </div>
                                ))
                              ) : (
                                <span className="text-muted text-sm">No cards shown</span>
                              )}
                            </div>
                          </div>

                          {/* Players */}
                          <div>
                            <p className="text-xs text-muted mb-2">Players</p>
                            <div className="space-y-2">
                              {details.players.map((player, i) => {
                                const holeCards = player.holeCards
                                  ? JSON.parse(player.holeCards)
                                  : null;
                                const finalHand = player.finalHand
                                  ? JSON.parse(player.finalHand)
                                  : null;
                                const isMe = player.userAddress === connection.walletPubKey;

                                return (
                                  <div
                                    key={i}
                                    className={`p-3 rounded ${isMe ? 'bg-primary/10 border border-primary/30' : 'bg-secondary/50'}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-sm font-medium ${isMe ? 'text-primary' : 'text-foreground'}`}
                                        >
                                          {player.userName || `Seat ${player.seatIndex + 1}`} {isMe && '(You)'}
                                        </span>
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded ${
                                            player.result === 'won'
                                              ? 'bg-green-500/20 text-green-400'
                                              : player.result === 'split'
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : player.result === 'folded'
                                                  ? 'bg-gray-500/20 text-gray-400'
                                                  : 'bg-red-500/20 text-red-400'
                                          }`}
                                        >
                                          {player.result.toUpperCase()}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-sm font-semibold ${player.won > 0 ? 'text-green-400' : 'text-muted'}`}
                                      >
                                        {player.won > 0 ? `+${player.won.toLocaleString()}` : '0'} OCT
                                      </span>
                                    </div>

                                    {/* Hole Cards */}
                                    {holeCards && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-muted">Cards:</span>
                                        <div className="flex gap-1">
                                          {holeCards.map((card: string, j: number) => (
                                            <div
                                              key={j}
                                              className="w-8 h-11 bg-white rounded flex items-center justify-center text-sm font-bold"
                                            >
                                              {formatCard(card)}
                                            </div>
                                          ))}
                                        </div>
                                        {finalHand && (
                                          <span className="text-xs text-yellow-400 ml-2">
                                            {finalHand.name}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Stack Changes */}
                                    <div className="flex items-center gap-4 text-xs text-muted">
                                      <span>Start: {player.startingStack.toLocaleString()}</span>
                                      <span>→</span>
                                      <span>End: {player.endingStack.toLocaleString()}</span>
                                      <span className="text-yellow-400">
                                        Bet: {player.totalBet.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted text-sm py-4">Failed to load details</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  subValue,
  valueColor = 'text-foreground',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      {subValue && <p className="text-xs text-muted mt-1">{subValue}</p>}
    </div>
  );
}
