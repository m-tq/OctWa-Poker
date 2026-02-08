import { useState, useEffect } from "react";
import {
  Timer,
  Users,
  Pause,
  Trophy,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Tournament, BlindLevel } from "@/types/game";

interface TournamentOverlayProps {
  tournament: Tournament;
  onNavigateToLobby?: () => void;
}

function formatTimer(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimerLong(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TournamentOverlay({
  tournament,
  onNavigateToLobby,
}: TournamentOverlayProps) {
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);

  // Live clock — tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isRunning =
    tournament.status === "running" || tournament.status === "final_table";
  const isPaused = tournament.status === "paused";

  if (!isRunning && !isPaused) return null;

  const currentBlindIndex = tournament.currentBlindLevel;
  const currentBlind: BlindLevel | undefined =
    tournament.structure.blindLevels[currentBlindIndex];
  const nextBlind: BlindLevel | undefined =
    tournament.structure.blindLevels[currentBlindIndex + 1];

  const nextBlindTime = tournament.nextBlindLevelAt
    ? Math.max(0, tournament.nextBlindLevelAt - now)
    : 0;

  const breakTime =
    tournament.isOnBreak && tournament.breakEndsAt
      ? Math.max(0, tournament.breakEndsAt - now)
      : 0;

  const playingCount = tournament.participants.filter(
    (p) => p.status === "playing",
  ).length;

  const totalActive = tournament.participants.filter(
    (p) =>
      p.status === "registered" ||
      p.status === "approved" ||
      p.status === "playing",
  ).length;

  const isTimerUrgent = nextBlindTime > 0 && nextBlindTime < 60000;

  // Timer bar percentage
  const levelDurationMs =
    (currentBlind?.durationMinutes ?? 15) * 60 * 1000;
  const elapsed = levelDurationMs - nextBlindTime;
  const progressPct = levelDurationMs > 0
    ? Math.min(100, Math.max(0, (elapsed / levelDurationMs) * 100))
    : 0;

  return (
    <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
      {/* ─── Compact bar (always visible) ─── */}
      <div className="pointer-events-auto">
        <div
          className="mx-auto max-w-md mt-1 glass transition-all duration-300 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
          }}
          aria-label="Toggle tournament info"
        >
          {/* Progress bar along top edge */}
          {!tournament.isOnBreak && !isPaused && nextBlindTime > 0 && (
            <div className="h-[2px] bg-secondary/30 w-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 linear ${
                  isTimerUrgent
                    ? "bg-red-500 timer-bar-urgent"
                    : "bg-primary timer-bar"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Main compact row */}
          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            {/* Left: Level + Blinds */}
            <div className="flex items-center gap-2 min-w-0">
              {tournament.status === "final_table" && (
                <Badge variant="danger" size="sm">
                  <Trophy className="w-3 h-3 mr-0.5" />
                  FT
                </Badge>
              )}
              {isPaused && (
                <Badge variant="warning" size="sm">
                  <Pause className="w-3 h-3 mr-0.5" />
                  Paused
                </Badge>
              )}
              {tournament.isOnBreak && (
                <Badge variant="primary" size="sm">
                  ☕ Break
                </Badge>
              )}
              {!tournament.isOnBreak && !isPaused && currentBlind && (
                <>
                  <span className="text-[10px] text-muted uppercase tracking-wider font-medium shrink-0">
                    Lvl {currentBlindIndex + 1}
                  </span>
                  <span className="text-xs font-mono text-foreground font-semibold">
                    {currentBlind.smallBlind}/{currentBlind.bigBlind}
                    {currentBlind.ante > 0 && (
                      <span className="text-muted font-normal ml-0.5">
                        ({currentBlind.ante})
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>

            {/* Center: Timer */}
            <div className="flex items-center gap-1.5 shrink-0">
              {tournament.isOnBreak ? (
                <span className="text-xs font-mono text-blue-400">
                  {formatTimer(breakTime)}
                </span>
              ) : isPaused ? (
                <span className="text-xs font-mono text-yellow-400 animate-subtle-pulse">
                  ⏸
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <Timer
                    className={`w-3 h-3 ${isTimerUrgent ? "text-red-400" : "text-muted"}`}
                  />
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isTimerUrgent
                        ? "text-red-400 animate-subtle-pulse"
                        : "text-foreground"
                    }`}
                  >
                    {formatTimer(nextBlindTime)}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Players + expand toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <Users className="w-3 h-3" />
                <span className="font-mono text-foreground">
                  {playingCount}
                </span>
              </div>
              {expanded ? (
                <ChevronUp className="w-3 h-3 text-muted" />
              ) : (
                <ChevronDown className="w-3 h-3 text-muted" />
              )}
            </div>
          </div>

          {/* ─── Expanded panel ─── */}
          {expanded && (
            <div className="border-t border-white/[0.06] px-3 py-2 space-y-2 animate-fade-in">
              {/* Tournament name */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted uppercase tracking-wider">
                  {tournament.name}
                </span>
                {onNavigateToLobby && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToLobby();
                    }}
                    className="text-[10px] text-primary hover:shadow-[0_0_6px_rgba(59,130,246,0.4)] transition-shadow"
                  >
                    Tournament Lobby →
                  </button>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat
                  label="Players"
                  value={`${playingCount} / ${totalActive}`}
                />
                <MiniStat
                  label="Prize Pool"
                  value={`${tournament.totalPrizePool} OCT`}
                  highlight
                />
                <MiniStat
                  label="Tables"
                  value={String(tournament.tableIds.length)}
                />
              </div>

              {/* Current + Next blind */}
              {currentBlind && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.03] border border-white/[0.06] p-2">
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">
                      Current
                    </div>
                    <div className="font-mono text-xs text-foreground">
                      {currentBlind.smallBlind}/{currentBlind.bigBlind}
                      {currentBlind.ante > 0 && (
                        <span className="text-muted"> ante {currentBlind.ante}</span>
                      )}
                    </div>
                  </div>
                  {nextBlind ? (
                    <div className="bg-white/[0.03] border border-white/[0.06] p-2">
                      <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">
                        Next
                      </div>
                      <div className="font-mono text-xs text-foreground">
                        {nextBlind.smallBlind}/{nextBlind.bigBlind}
                        {nextBlind.ante > 0 && (
                          <span className="text-muted"> ante {nextBlind.ante}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/[0.03] border border-white/[0.06] p-2">
                      <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">
                        Next
                      </div>
                      <div className="text-xs text-muted">Final level</div>
                    </div>
                  )}
                </div>
              )}

              {/* Warning if about to level up */}
              {isTimerUrgent && !tournament.isOnBreak && !isPaused && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400 animate-fade-in">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Blinds increasing soon!</span>
                </div>
              )}

              {/* Break info */}
              {tournament.isOnBreak && (
                <div className="text-center text-xs text-blue-400">
                  Break ends in{" "}
                  <span className="font-mono font-semibold">
                    {formatTimerLong(breakTime)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Mini stat used in expanded panel */
function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] p-1.5">
      <div className="text-[9px] text-muted uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-mono text-xs font-semibold ${
          highlight ? "text-yellow-400" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
