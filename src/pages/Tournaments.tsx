import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/Button";
import {
  TournamentList,
  CreateTournamentDialog,
} from "@/components/tournament";
import { Plus, RefreshCw, Trophy } from "lucide-react";

type FilterType = "all" | "registering" | "running" | "completed";

const filterOptions: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "registering", label: "Open" },
  { id: "running", label: "Live" },
  { id: "completed", label: "Ended" },
];

export function Tournaments() {
  const navigate = useNavigate();
  const { connected, connection, tournaments, tournamentsLoading, username } =
    useStore();

  const { getTournaments, createTournament, joinTournament } = useSocket();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  // Fetch tournaments on mount
  useEffect(() => {
    if (connected) {
      getTournaments();
    }
  }, [connected, getTournaments]);

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="text-center animate-fade-in">
          <Trophy className="w-12 h-12 text-muted mx-auto mb-4 opacity-40" />
          <p className="text-muted mb-4">
            Please connect your wallet to view tournaments
          </p>
        </div>
      </div>
    );
  }

  const handleView = (tournamentId: string) => {
    navigate(`/tournament/${tournamentId}`);
  };

  const handleQuickJoin = (tournamentId: string) => {
    if (!connection) return;
    const playerName =
      username || `Player_${connection.walletPubKey.slice(0, 6)}`;
    joinTournament({
      tournamentId,
      address: connection.walletPubKey,
      name: playerName,
    });
  };

  const handleCreate = (data: {
    name: string;
    structure: any;
    maxParticipants: number;
  }) => {
    createTournament(data);
    setShowCreateDialog(false);
  };

  const handleRefresh = () => {
    getTournaments();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Tournaments
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Tournament
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors relative ${
              filter === opt.id
                ? "text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
            {filter === opt.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        ))}

        {/* Count badge */}
        <div className="ml-auto text-xs text-muted font-mono py-2">
          {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tournament list */}
      <TournamentList
        tournaments={tournaments}
        loading={tournamentsLoading}
        onView={handleView}
        onJoin={handleQuickJoin}
        currentAddress={connection?.walletPubKey}
        filter={filter}
      />

      {/* Create dialog */}
      <CreateTournamentDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
