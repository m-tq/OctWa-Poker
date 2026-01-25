import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { API_URL } from '@/config';
import { useStore } from '@/store';
import { sendTransaction, getOrRequestCapability } from '@/sdk/octra';
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

type Step = 'select' | 'sending' | 'verifying';

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
  const [statusMessage, setStatusMessage] = useState('');

  // Get capability from store
  const capability = useStore((state) => state.capability);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('select');
      setQuote(null);
      setQuoteError(null);
      setStatusMessage('');
      setBuyIn(table?.minBuyIn ?? 0);
      setSelectedSeat(null);
    }
  }, [open, table?.minBuyIn]);

  if (!table) return null;

  const availableSeats = table.players
    .map((p, i) => (p === null ? i : -1))
    .filter((i) => i !== -1);

  const minBuyIn = table.minBuyIn;
  const maxBuyIn = Math.min(table.maxBuyIn, walletBalance);
  const canAfford = walletBalance >= minBuyIn;

  // Main flow: Get quote → Send transaction via SDK → Verify on backend
  const handleBuyIn = async () => {
    if (selectedSeat === null) return;

    setIsLoading(true);
    setQuoteError(null);
    setStatusMessage('Getting game wallet...');

    try {
      // Step 1: Get quote from server
      const quoteResponse = await fetch(`${API_URL}/api/game-wallet/quote`, {
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

      const quoteData = await quoteResponse.json();

      if (!quoteResponse.ok) {
        throw new Error(quoteData.error || 'Failed to get quote');
      }

      const quoteInfo: BuyInQuote = quoteData.quote;
      setQuote(quoteInfo);
      setStep('sending');
      setStatusMessage('Sending OCT to game wallet...');

      // Step 2: Get or request capability (will show popup if needed)
      let cap = capability;
      if (!cap || cap.expiresAt < Date.now()) {
        setStatusMessage('Requesting wallet authorization...');
        cap = await getOrRequestCapability(capability?.id, true); // Request if missing
        if (!cap) {
          throw new Error('Failed to get wallet capability. Please reconnect wallet.');
        }
      }

      // Step 3: Send transaction via SDK with encoded message for validation
      setStatusMessage('Please confirm transaction in your wallet...');
      const txResult = await sendTransaction(
        cap.id,
        quoteInfo.gameWalletAddress,
        quoteInfo.amount,
        quoteInfo.encodedMessage // Include message for ownership validation
      );

      const txHash = txResult.txHash;
      console.log('[GameWalletBuyIn] Transaction sent:', txHash);

      // Step 4: Verify the transaction on backend
      setStep('verifying');
      setStatusMessage('Verifying deposit on blockchain...');

      const verifyResponse = await fetch(`${API_URL}/api/game-wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: quoteInfo.sessionId,
          txHash: txHash,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Verification failed');
      }

      // Success! Join the table
      setStatusMessage('Success! Joining table...');
      onConfirm(buyIn, selectedSeat, quoteInfo.sessionId);
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error('[GameWalletBuyIn] Error:', errorMessage);
      setQuoteError(errorMessage);
      setStep('select');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // Non-game-wallet flow (legacy)
  const handleLegacyConfirm = () => {
    if (selectedSeat === null || isJoining) return;
    onConfirm(buyIn, selectedSeat, '');
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

        {/* Step: Select amount and seat */}
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
                  onClick={handleBuyIn}
                  disabled={!canAfford || selectedSeat === null || isLoading}
                >
                  {isLoading ? 'Processing...' : 'Buy In with OCT'}
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

        {/* Step: Sending/Verifying - Show progress */}
        {(step === 'sending' || step === 'verifying') && (
          <div className="py-8 text-center">
            {/* Loading spinner */}
            <div className="flex justify-center mb-4">
              <svg
                className="w-12 h-12 text-primary animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            {/* Status message */}
            <p className="text-foreground font-medium mb-2">{statusMessage}</p>

            {/* Quote info */}
            {quote && (
              <div className="bg-secondary p-3 text-sm mt-4 text-left rounded">
                <div className="flex justify-between mb-1">
                  <span className="text-muted">Amount:</span>
                  <span className="text-foreground font-medium">{quote.amount} OCT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Game Wallet:</span>
                  <span className="text-foreground text-xs font-mono truncate max-w-[180px]">
                    {quote.gameWalletAddress}
                  </span>
                </div>
              </div>
            )}

            {/* Cancel button (only during sending, not verifying) */}
            {step === 'sending' && !isLoading && (
              <div className="mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('select');
                    setQuote(null);
                    setStatusMessage('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
