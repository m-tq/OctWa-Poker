import { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { API_URL } from '@/config';

interface LeaderboardEntry {
  address: string;
  name: string;
  handsPlayed: number;
  handsWon: number;
  totalWinnings: number;
  netProfit: number;
}

interface LeaderboardProps {
  open: boolean;
  onClose: () => void;
}

export function Leaderboard({ open, onClose }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/leaderboard?limit=20`);
        if (response.ok) {
          const data = await response.json();
          setEntries(data);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [open]);

  if (!open) return null;

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 2:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted text-sm">{index + 1}</span>;
    }
  };

  const getRankBg = (index: number) => {
    switch (index) {
      case 0:
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 1:
        return 'bg-gray-500/10 border-gray-500/30';
      case 2:
        return 'bg-amber-500/10 border-amber-500/30';
      default:
        return 'bg-secondary/50 border-transparent';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-foreground">Leaderboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No players yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <div
                  key={entry.address}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${getRankBg(index)}`}
                >
                  {/* Rank */}
                  <div className="w-8 flex justify-center">
                    {getRankIcon(index)}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{entry.name}</p>
                    <p className="text-xs text-muted">
                      {entry.handsWon}/{entry.handsPlayed} hands won
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <p className={`font-semibold ${entry.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.netProfit >= 0 ? '+' : ''}{entry.netProfit.toLocaleString()} OCT
                    </p>
                    <p className="text-xs text-muted">
                      Won: {entry.totalWinnings.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
