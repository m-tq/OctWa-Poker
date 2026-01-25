import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { API_URL } from '@/config';
import type { Table } from '@/types/game';

interface BuyInQuote {
  sessionId: string;
  gameWalletAddress: string;
  amount: number;
  expiresAt: number;
  encodedMessage: string;
}

interface GameWalletBuyInDialogProps {
  open: boolean;
  onClose: () => void;
  table: Table | null;
  walletBalance: number;
  walletAddress: string;
  playerName: string;
  onConfirm: (buyIn: number, seatIndex: number, sessionId: string) => void;
  isJoining?: boolean;
  error?: string | null;
  gameWalletEnabled?: boolean;
}

type Step = 'select' | 'quote' | 'transfer' | 'verify';

export function GameWalletBuyInDialog({
  open,
  onClose,
  table,
  walletBalance,
  walletAddress,
  playerName,
  onConfirm,
  isJoining = false,
  error = null,
  gameWalletEnabled = false,
}: GameWalletBuyInDialogProps) {
  const [buyIn, setBuyIn] = useState(table?.minBuyIn ?? 0);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [quote, setQuote] = useState<BuyInQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('select');
      setQuote(null);
      setQuoteError(null);
      setTxHash('');
      setBuyIn(table?.minBuyIn ?? 0);
      setSelectedSeat(null);
    }
  }, [open, table?.minBuyIn]);

  // Countdown timer for quote expiry
  useEffect(() => {
    if (!quote) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setQuoteError('Quote expired. Please try again.');
        setStep('select');
        setQuote(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [quote]);

  if (!table) return null;

  const availableSeats = table.players
    .map((p, i) => (p === null ? i : -1))
    .filter((i) => i !== -1);

  const minBuyIn = table.minBuyIn;
  const maxBuyIn = Math.min(table.maxBuyIn, walletBalance);
  const canAfford = walletBalance >= minBuyIn;

  // Step 1: Get quote from server
  const handleGetQuote = async () => {
    if (selectedSeat === null) return;

    setIsLoading(true);
    setQuoteError(null);

    try {
      const response = await fetch(`${API_URL}/api/game-wallet/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: walletAddress,
          playerName,
          tableId: table.id,
          seatIndex: selectedSeat,
          amount: buyIn,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get quote');
      }

      setQuote(data.quote);
      setStep('quote');
    } catch (err) {
      setQuoteError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: User confirms they've sent the transaction
  const handleConfirmTransfer = () => {
    setStep('transfer');
  };

  // Step 3: Verify the transaction
  const handleVerifyDeposit = async () => {
    if (!quote || !txHash.trim()) return;

    setIsLoading(true);
    setQuoteError(null);

    try {
      const response = await fetch(`${API_URL}/api/game-wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: quote.sessionId,
          txHash: txHash.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      // Success! Join the table
      onConfirm(buyIn, selectedSeat!, quote.sessionId);
    } catch (err) {
      setQuoteError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Non-game-wallet flow (legacy)
  const handleLegacyConfirm = () => {
    if (selectedSeat === null || isJoining) return;
    onConfirm(buyIn, selectedSeat, '');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Buy In">
      <div className="space-y-6">
        {/* Error Message */}
        {(error || quoteError) && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 text-sm">
            {error || quoteError}
          </div>
        )}

        {/* Step 1: Select amount and seat */}
        {step === 'select' && (
          <>
            {/* Table Info */}
            <div className="bg-secondary p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted">Table:</span>
                <span className="text-foreground">{table.name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Blinds:</span>
                <span className="text-foreground">
                  {table.smallBlind}/{table.bigBlind} OCT
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Buy-in Range:</span>
                <span className="text-foreground">
                  {table.minBuyIn} - {table.maxBuyIn} OCT
                </span>
              </div>
            </div>

            {/* Wallet Balance */}
            <div className="flex justify-between text-sm">
              <span className="text-muted">Your Balance:</span>
              <span className={`font-medium ${canAfford ? 'text-foreground' : 'text-destructive'}`}>
                {walletBalance.toLocaleString()} OCT
              </span>
            </div>

            {!canAfford ? (
              <div className="text-center py-4">
                <p className="text-destructive">Insufficient balance</p>
                <p className="text-sm text-muted mt-1">
                  You need at least {minBuyIn} OCT to join this table
                </p>
              </div>
            ) : (
              <>
                {/* Buy-in Slider */}
                <Slider
                  label="Buy-in Amount"
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                  min={minBuyIn}
                  max={maxBuyIn}
                  step={table.bigBlind}
                  formatValue={(v) => `${v.toLocaleString()} OCT`}
                />

                {/* Seat Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Select Seat</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: table.maxPlayers }, (_, i) => {
                      const isAvailable = availableSeats.includes(i);
                      const isSelected = selectedSeat === i;

                      return (
                        <button
                          key={i}
                          onClick={() => isAvailable && setSelectedSeat(i)}
                          disabled={!isAvailable}
                          className={`
                            p-2 text-sm border transition-colors
                            ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : isAvailable
                                  ? 'bg-secondary text-foreground border-border hover:border-primary'
                                  : 'bg-secondary/50 text-muted border-border cursor-not-allowed'
                            }
                          `}
                        >
                          Seat {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              {gameWalletEnabled ? (
                <Button
                  onClick={handleGetQuote}
                  disabled={!canAfford || selectedSeat === null || isLoading}
                >
                  {isLoading ? 'Getting Quote...' : 'Get Game Wallet'}
                </Button>
              ) : (
                <Button
                  onClick={handleLegacyConfirm}
                  disabled={!canAfford || selectedSeat === null || isJoining}
                >
                  {isJoining ? 'Joining...' : 'Confirm Buy-in'}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Step 2: Show quote and game wallet address */}
        {step === 'quote' && quote && (
          <>
            <div className="bg-primary/10 border border-primary p-4 text-center">
              <p className="text-sm text-muted mb-2">Send exactly</p>
              <p className="text-2xl font-bold text-primary">{quote.amount} OCT</p>
              <p className="text-sm text-muted mt-2">to your game wallet below</p>
            </div>

            <div className="bg-secondary p-3">
              <label className="text-xs text-muted block mb-1">Game Wallet Address</label>
              <div className="flex items-center gap-2">
                <code className="text-xs text-foreground break-all flex-1">{quote.gameWalletAddress}</code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(quote.gameWalletAddress)}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="bg-secondary p-3">
              <label className="text-xs text-muted block mb-1">Message Payload (include in memo)</label>
              <div className="flex items-center gap-2">
                <code className="text-xs text-foreground break-all flex-1">{quote.encodedMessage}</code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(quote.encodedMessage)}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted">Time Remaining:</span>
              <span className={`font-medium ${timeRemaining < 60 ? 'text-destructive' : 'text-foreground'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button onClick={handleConfirmTransfer}>I've Sent the Transaction</Button>
            </div>
          </>
        )}

        {/* Step 3: Enter transaction hash */}
        {step === 'transfer' && quote && (
          <>
            <div className="bg-secondary p-3 text-sm">
              <p className="text-muted mb-2">Enter the transaction hash to verify your deposit:</p>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Transaction hash..."
                className="w-full p-2 bg-background border border-border text-foreground text-sm"
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted">Time Remaining:</span>
              <span className={`font-medium ${timeRemaining < 60 ? 'text-destructive' : 'text-foreground'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setStep('quote')} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleVerifyDeposit} disabled={!txHash.trim() || isLoading}>
                {isLoading ? 'Verifying...' : 'Verify Deposit'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
