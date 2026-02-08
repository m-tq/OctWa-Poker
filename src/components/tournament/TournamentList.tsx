import { Trophy } from 'lucide-react';
import { TournamentCard } from './TournamentCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Tournament } from '@/types/game';

interface TournamentListProps {
  tournaments: Tournament[];
  loading: boolean;
  onView: (tournamentId: string) => void;
  onJoin?: (tournamentId: string) => void;
  currentAddress?: string;
  filter?: 'all' | 'registering' | 'running' | 'completed';
}

export function TournamentList({
  tournaments,
  loading,
  onView,
  onJoin,
  currentAddress,
  filter = 'all',
}: TournamentListProps) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px]" />
        ))}
      </div>
    );
  }

  const filtered =
    filter === 'all'
      ? tournaments
      : tournaments.filter((t) => {
          if (filter === 'registering') return t.status === 'registering' || t.status === 'pending';
          if (filter === 'running')
            return t.status === 'running' || t.status === 'paused' || t.status === 'final_table';
          if (filter === 'completed') return t.status === 'completed' || t.status === 'cancelled';
          return true;
        });

  if (filtered.length === 0) {
    return (
      <div className="bg-card border border-border p-8 text-center animate-fade-in">
        <Trophy className="w-12 h-12 text-muted mx-auto mb-4 opacity-40" />
        <p className="text-muted">No tournaments available</p>
        <p className="text-sm text-muted mt-2">
          {filter === 'all'
            ? 'Create a tournament to get started'
            : `No ${filter} tournaments at the moment`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {filtered.map((tournament) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          onView={onView}
          onJoin={onJoin}
          currentAddress={currentAddress}
        />
      ))}
    </div>
  );
}
