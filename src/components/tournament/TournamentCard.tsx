import {
  Users,
  Clock,
  Trophy,
  Coins,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Tournament } from "@/types/game";

interface TournamentCardProps {
  tournament: Tournament;
  onView: (tournamentId: string) => void;
  onJoin?: (tournamentId: string) => void;
  currentAddress?: string;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "success" | "warning" | "danger" | "primary" | "muted";
    icon: React.ReactNode;
  }
> = {
  registering: {
    label: "Open",
    variant: "success",
    icon: <Users className="w-3 h-3" />,
  },
  pending: {
    label: "Starting",
    variant: "warning",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  running: {
    label: "Running",
    variant: "primary",
    icon: <Play className="w-3 h-3" />,
  },
  paused: {
    label: "Paused",
    variant: "warning",
    icon: <Pause className="w-3 h-3" />,
  },
  final_table: {
    label: "Final Table",
    variant: "danger",
    icon: <Trophy className="w-3 h-3" />,
  },
  completed: {
    label: "Completed",
    variant: "muted",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  cancelled: {
    label: "Cancelled",
    variant: "muted",
    icon: <XCircle className="w-3 h-3" />,
  },
};

export function TournamentCard({
  tournament,
  onView,
  onJoin,
  currentAddress,
}: TournamentCardProps) {
  const participantCount = tournament.participants.filter(
    (p) =>
      p.status === "registered" ||
      p.status === "approved" ||
      p.status === "playing",
  ).length;
  const isHost = currentAddress === tournament.hostAddress;
  const isRegistered = tournament.participants.some(
    (p) =>
      p.address === currentAddress &&
      (p.status === "registered" ||
        p.status === "approved" ||
        p.status === "playing"),
  );
  const isFull = participantCount >= tournament.maxParticipants;
  const canRegister =
    tournament.status === "registering" && !isRegistered && !isFull && !isHost;
  const status = statusConfig[tournament.status] || statusConfig.cancelled;

  const blindLevel = tournament.structure.blindLevels[0];
  const currentBlind =
    tournament.status === "running" || tournament.status === "final_table"
      ? tournament.structure.blindLevels[tournament.currentBlindLevel] ||
        blindLevel
      : blindLevel;

  return (
    <div
      className="bg-card border border-border p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_0_12px_rgba(59,130,246,0.08)] animate-fade-in-up group cursor-pointer"
      onClick={() => onView(tournament.id)}
    >
      {/* Top row: Name + Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">
              {tournament.name}
            </h3>
            {isHost && (
              <Badge variant="primary" size="sm">
                Host
              </Badge>
            )}
            {isRegistered && !isHost && (
              <Badge variant="success" size="sm">
                Joined
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted font-mono">
            ID: {tournament.id.slice(0, 8)}…
          </p>
        </div>
        <Badge variant={status.variant} size="sm">
          <span className="flex items-center gap-1">
            {status.icon}
            {status.label}
          </span>
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {/* Players */}
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono text-foreground">{participantCount}</span>
          <span className="text-xs">/ {tournament.maxParticipants}</span>
        </div>

        {/* Buy-in */}
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Coins className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono text-foreground">
            {tournament.structure.buyInAmount}
          </span>
          <span className="text-xs">OCT</span>
        </div>

        {/* Starting stack */}
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Trophy className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono text-foreground">
            {tournament.structure.startingStack.toLocaleString()}
          </span>
          <span className="text-xs">chips</span>
        </div>

        {/* Blinds */}
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono text-foreground">
            {currentBlind.smallBlind}/{currentBlind.bigBlind}
          </span>
          {currentBlind.ante > 0 && (
            <span className="text-xs">(ante {currentBlind.ante})</span>
          )}
        </div>
      </div>

      {/* Prize pool + timing */}
      <div className="flex items-center justify-between text-xs text-muted border-t border-border pt-3">
        <div className="flex items-center gap-3">
          {tournament.totalPrizePool > 0 && (
            <span>
              Prize:{" "}
              <span className="text-yellow-400 font-mono font-semibold">
                {tournament.totalPrizePool} OCT
              </span>
            </span>
          )}
          {tournament.status === "running" && (
            <span>
              Level:{" "}
              <span className="text-foreground font-mono">
                {tournament.currentBlindLevel + 1}
              </span>
            </span>
          )}
          {tournament.structure.allowReentry && (
            <span className="text-blue-400">Re-entry allowed</span>
          )}
        </div>

        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {canRegister && onJoin && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onJoin(tournament.id)}
            >
              Register
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onView(tournament.id)}
          >
            {isHost ? "Manage" : "View"}
          </Button>
        </div>
      </div>
    </div>
  );
}
