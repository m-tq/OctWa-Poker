import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import type { Table } from '@/types/game';

interface BuyInDialogProps {
  open: boolean;
  onClose: () => void;
  table: Table | null;
  walletBalance: number;
  onConfirm: (buyIn: number, seatIndex: number) => void;
  isJoining?: boolean;
  error?: string | null;
}

export function BuyInDialog({ open, onClose, table, walletBalance, onConfirm, isJoining = false, error = null }: BuyInDialogProps) {
  const [buyIn, setBuyIn] = useState(table?.minBuyIn ?? 0);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  if (!table) return null;

  const availableSeats = table.players
    .map((p, i) => p === null ? i : -1)
    .filter(i => i !== -1);

  const minBuyIn = table.minBuyIn;
  const maxBuyIn = Math.min(table.maxBuyIn, walletBalance);
  const canAfford = walletBalance >= minBuyIn;

  const handleConfirm = () => {
    if (selectedSeat === null || isJoining) return;
    onConfirm(buyIn, selectedSeat);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Buy In">
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 text-sm">
            {error}
          </div>
        )}

        {/* Table Info */}
        <div className="bg-secondary p-3 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-muted">Table:</span>
            <span className="text-foreground">{table.name}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-muted">Blinds:</span>
            <span className="text-foreground">{table.smallBlind}/{table.bigBlind} OCT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Buy-in Range:</span>
            <span className="text-foreground">{table.minBuyIn} - {table.maxBuyIn} OCT</span>
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
              onChange={e => setBuyIn(Number(e.target.value))}
              min={minBuyIn}
              max={maxBuyIn}
              step={table.bigBlind}
              formatValue={v => `${v.toLocaleString()} OCT`}
            />

            {/* Seat Selection */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Select Seat
              </label>
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
                        ${isSelected 
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
          <Button variant="secondary" onClick={onClose} disabled={isJoining}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!canAfford || selectedSeat === null || isJoining}
          >
            {isJoining ? 'Joining...' : 'Confirm Buy-in'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
