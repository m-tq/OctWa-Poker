import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Trophy,
  Clock,
  Coins,
  Play,
  Pause,
  XCircle,
  CheckCircle,
  Copy,
  Check,
  ArrowLeft,
  Shield,
  RotateCcw,
  Crown,
  Medal,
  Timer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type {
  Tournament,
  TournamentParticipant,
  TournamentParticipantStatus,
  BlindLevel,
} from "@/types/game";

interface TournamentLobbyProps {
  tournament: Tournament;
  currentAddress?: string;
  username?: string;
  onBack: () => void;
  onJoin: (tournamentId: string, address: string, name: string) => void;
  onAction: (
    tournamentId: string,
    action: "start" | "pause" | "resume" | "cancel",
  ) => void;
  onApprove: (
    tournamentId: string,
    participantId: string,
    action: "approve" | "reject",
  ) => void;
  onReentry: (tournamentId: string) => void;
  onNavigateToTable?: (tableId: string) => void;
}

type Tab = "overview" | "participants" | "structure" | "results";

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "success" | "warning" | "danger" | "primary" | "muted";
  }
> = {
  registering: { label: "Registration Open", variant: "success" },
  pending: { label: "Starting Soon", variant: "warning" },
  running: { label: "In Progress", variant: "primary" },
  paused: { label: "Paused", variant: "warning" },
  final_table: { label: "Final Table", variant: "danger" },
  completed: { label: "Completed", variant: "muted" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const participantStatusConfig: Record<
  TournamentParticipantStatus,
  {
    label: string;
    variant: "success" | "warning" | "danger" | "primary" | "muted";
  }
> = {
  registered: { label: "Registered", variant: "primary" },
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  playing: { label: "Playing", variant: "success" },
  eliminated: { label: "Eliminated", variant: "danger" },
  reentry_requested: { label: "Re-entry Req", variant: "warning" },
  withdrawn: { label: "Withdrawn", variant: "muted" },
};

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TournamentLobby({
  tournament,
  currentAddress,
  username,
  onBack,
  onJoin,
  onAction,
  onApprove,
  onReentry,
  onNavigateToTable,
}: TournamentLobbyProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [blindsExpanded, setBlindsExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live clock for timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isHost = currentAddress === tournament.hostAddress;
  const status = statusConfig[tournament.status] || statusConfig.cancelled;

  const myParticipant = useMemo(
    () => tournament.participants.find((p) => p.address === currentAddress),
    [tournament.participants, currentAddress],
  );

  const isRegistered = myParticipant
    ? ["registered", "approved", "playing"].includes(myParticipant.status)
    : false;

  const isEliminated = myParticipant?.status === "eliminated";

  const activeParticipants = useMemo(
    () =>
      tournament.participants.filter(
        (p) =>
          p.status === "registered" ||
          p.status === "approved" ||
          p.status === "playing",
      ),
    [tournament.participants],
  );

  const playingParticipants = useMemo(
    () => tournament.participants.filter((p) => p.status === "playing"),
    [tournament.participants],
  );

  const pendingParticipants = useMemo(
    () => tournament.participants.filter((p) => p.status === "pending"),
    [tournament.participants],
  );

  const eliminatedParticipants = useMemo(
    () =>
      tournament.participants
        .filter((p) => p.status === "eliminated")
        .sort((a, b) => (b.eliminatedAt || 0) - (a.eliminatedAt || 0)),
    [tournament.participants],
  );

  const isFull = activeParticipants.length >= tournament.maxParticipants;
  const canRegister =
    (tournament.status === "registering" ||
      (tournament.status === "running" &&
        tournament.currentBlindLevel <
          tournament.structure.lateRegistrationLevels)) &&
    !isRegistered &&
    !isFull &&
    !isHost &&
    currentAddress;

  const canReentry =
    isEliminated &&
    tournament.structure.allowReentry &&
    (myParticipant?.reentryCount ?? 0) < tournament.structure.maxReentries &&
    tournament.currentBlindLevel < tournament.structure.reentryDeadlineLevel;

  const currentBlindLevel =
    tournament.structure.blindLevels[tournament.currentBlindLevel] ||
    tournament.structure.blindLevels[0];

  const nextBlindTime = tournament.nextBlindLevelAt
    ? Math.max(0, tournament.nextBlindLevelAt - now)
    : 0;

  const breakTime =
    tournament.isOnBreak && tournament.breakEndsAt
      ? Math.max(0, tournament.breakEndsAt - now)
      : 0;

  const canStart =
    isHost &&
    tournament.status === "registering" &&
    activeParticipants.length >= 2;

  const canPause = isHost && tournament.status === "running";
  const canResume = isHost && tournament.status === "paused";
  const canCancel =
    isHost &&
    (tournament.status === "registering" ||
      tournament.status === "pending" ||
      tournament.status === "paused");

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/tournament/${tournament.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    });
  };

  const handleJoin = () => {
    if (!currentAddress) return;
    const name = username || `Player_${currentAddress.slice(0, 6)}`;
    onJoin(tournament.id, currentAddress, name);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    {
      id: "participants",
      label: "Players",
      count: activeParticipants.length,
    },
    { id: "structure", label: "Structure" },
  ];
  if (tournament.status === "completed" && tournament.results.length > 0) {
    tabs.push({ id: "results", label: "Results" });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* ─── Header ─── */}
      <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <button
                onClick={handleCopyInvite}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                title="Copy invite link"
              >
                {copiedInvite ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedInvite ? "Copied!" : "Invite"}
              </button>
            </div>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground tracking-tight truncate">
                {tournament.name}
              </h1>
              <p className="text-xs text-muted font-mono mt-0.5">
                {tournament.id.slice(0, 12)}…
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-4 shrink-0 text-xs">
              <div className="text-center">
                <div className="font-mono text-foreground text-sm font-semibold">
                  {activeParticipants.length}
                  <span className="text-muted font-normal">
                    /{tournament.maxParticipants}
                  </span>
                </div>
                <div className="text-muted">Players</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-yellow-400 text-sm font-semibold">
                  {tournament.totalPrizePool ||
                    tournament.structure.buyInAmount *
                      activeParticipants.length}
                </div>
                <div className="text-muted">Prize OCT</div>
              </div>
              {(tournament.status === "running" ||
                tournament.status === "final_table") && (
                <div className="text-center">
                  <div className="font-mono text-foreground text-sm font-semibold">
                    {playingParticipants.length}
                  </div>
                  <div className="text-muted">Remaining</div>
                </div>
              )}
            </div>
          </div>

          {/* Live blind level bar (shown during play) */}
          {(tournament.status === "running" ||
            tournament.status === "final_table") &&
            !tournament.isOnBreak && (
              <div className="mt-3 bg-secondary/50 border border-border p-2 flex items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted uppercase tracking-wider font-medium">
                    Level {tournament.currentBlindLevel + 1}
                  </span>
                  <span className="font-mono text-foreground">
                    {currentBlindLevel.smallBlind}/{currentBlindLevel.bigBlind}
                    {currentBlindLevel.ante > 0 && (
                      <span className="text-muted">
                        {" "}
                        ante {currentBlindLevel.ante}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Timer className="w-3.5 h-3.5 text-muted" />
                  <span
                    className={`font-mono ${nextBlindTime < 60000 ? "text-red-400" : "text-foreground"}`}
                  >
                    {formatDuration(nextBlindTime)}
                  </span>
                </div>
              </div>
            )}

          {/* Break bar */}
          {tournament.isOnBreak && (
            <div className="mt-3 bg-blue-500/10 border border-blue-500/30 p-2 flex items-center justify-center gap-2 text-xs text-blue-400 animate-fade-in">
              <Pause className="w-3.5 h-3.5" />
              <span className="font-medium">BREAK</span>
              <span className="font-mono">{formatDuration(breakTime)}</span>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex mt-3 -mb-[1px]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors relative ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="font-mono text-[10px] opacity-60">
                      ({tab.count})
                    </span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* ──── Overview Tab ──── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in-up">
              {/* Left: Info + Actions */}
              <div className="lg:col-span-2 space-y-4">
                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox
                    label="Buy-in"
                    value={`${tournament.structure.buyInAmount} OCT`}
                    icon={<Coins className="w-4 h-4" />}
                  />
                  <StatBox
                    label="Starting Stack"
                    value={tournament.structure.startingStack.toLocaleString()}
                    icon={<Trophy className="w-4 h-4" />}
                  />
                  <StatBox
                    label="Blinds"
                    value={`${currentBlindLevel.smallBlind}/${currentBlindLevel.bigBlind}`}
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <StatBox
                    label="Tables"
                    value={String(tournament.tableIds.length || 1)}
                    icon={<Users className="w-4 h-4" />}
                  />
                </div>

                {/* Tournament details */}
                <div className="bg-card border border-border">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
                      Tournament Info
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    <InfoRow
                      label="Level Duration"
                      value={`${tournament.structure.blindLevelDurationMinutes} min`}
                    />
                    <InfoRow
                      label="Max Players / Table"
                      value={String(tournament.structure.maxPlayersPerTable)}
                    />
                    <InfoRow
                      label="Break"
                      value={
                        tournament.structure.breakAfterLevels > 0
                          ? `Every ${tournament.structure.breakAfterLevels} levels (${tournament.structure.breakDurationMinutes}min)`
                          : "None"
                      }
                    />
                    <InfoRow
                      label="Late Reg"
                      value={
                        tournament.structure.lateRegistrationLevels > 0
                          ? `Until level ${tournament.structure.lateRegistrationLevels}`
                          : "Disabled"
                      }
                    />
                    <InfoRow
                      label="Re-entry"
                      value={
                        tournament.structure.allowReentry
                          ? `Up to ${tournament.structure.maxReentries}x (deadline level ${tournament.structure.reentryDeadlineLevel})`
                          : "Disabled"
                      }
                    />
                    <InfoRow
                      label="Hand Timeout"
                      value={`${tournament.structure.handTimeoutSeconds}s`}
                    />
                  </div>
                </div>

                {/* Payout structure */}
                <div className="bg-card border border-border">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
                      Payout Structure
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-3">
                      {tournament.structure.payoutPercentages.map((pct, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-secondary/50 border border-border px-3 py-2"
                        >
                          <span className="text-xs text-muted">
                            {i === 0 && (
                              <Crown className="w-3.5 h-3.5 text-yellow-400 inline mr-1" />
                            )}
                            {i === 1 && (
                              <Medal className="w-3.5 h-3.5 text-gray-300 inline mr-1" />
                            )}
                            {i === 2 && (
                              <Medal className="w-3.5 h-3.5 text-amber-600 inline mr-1" />
                            )}
                            {i > 2 && `${i + 1}th`}
                          </span>
                          <span className="font-mono text-sm text-foreground font-semibold">
                            {pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Compact blind schedule */}
                <div className="bg-card border border-border">
                  <button
                    onClick={() => setBlindsExpanded(!blindsExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-foreground uppercase tracking-wider hover:bg-secondary/30 transition-colors"
                  >
                    <span>Blind Schedule</span>
                    {blindsExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted" />
                    )}
                  </button>
                  {blindsExpanded && (
                    <div className="border-t border-border animate-fade-in">
                      <BlindScheduleTable
                        blindLevels={tournament.structure.blindLevels}
                        currentLevel={tournament.currentBlindLevel}
                        breakAfterLevels={tournament.structure.breakAfterLevels}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Actions sidebar */}
              <div className="space-y-4">
                {/* Action card */}
                <div className="bg-card border border-border p-4 space-y-3">
                  {/* Registration actions */}
                  {canRegister && (
                    <Button onClick={handleJoin} className="w-full" size="lg">
                      <Coins className="w-4 h-4 mr-2" />
                      Register ({tournament.structure.buyInAmount} OCT)
                    </Button>
                  )}

                  {isRegistered && tournament.status === "registering" && (
                    <div className="bg-green-500/10 border border-green-500/30 p-3 text-center">
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <p className="text-sm text-green-400 font-medium">
                        You are registered
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Waiting for tournament to start
                      </p>
                    </div>
                  )}

                  {isRegistered &&
                    (tournament.status === "running" ||
                      tournament.status === "final_table") &&
                    myParticipant?.tableId &&
                    onNavigateToTable && (
                      <Button
                        onClick={() =>
                          onNavigateToTable(myParticipant.tableId!)
                        }
                        className="w-full"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Go to My Table
                      </Button>
                    )}

                  {canReentry && (
                    <Button
                      onClick={() => onReentry(tournament.id)}
                      variant="secondary"
                      className="w-full"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Request Re-entry ({tournament.structure.buyInAmount} OCT)
                    </Button>
                  )}

                  {isEliminated && !canReentry && (
                    <div className="bg-red-500/10 border border-red-500/30 p-3 text-center">
                      <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                      <p className="text-sm text-red-400 font-medium">
                        You have been eliminated
                      </p>
                      {myParticipant?.finishPosition && (
                        <p className="text-xs text-muted mt-1">
                          Finished #{myParticipant.finishPosition}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Host controls */}
                  {isHost && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider font-medium">
                          Host Controls
                        </span>
                      </div>

                      {canStart && (
                        <Button
                          onClick={() => onAction(tournament.id, "start")}
                          variant="success"
                          className="w-full"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Tournament
                        </Button>
                      )}

                      {canPause && (
                        <Button
                          onClick={() => onAction(tournament.id, "pause")}
                          variant="secondary"
                          className="w-full"
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </Button>
                      )}

                      {canResume && (
                        <Button
                          onClick={() => onAction(tournament.id, "resume")}
                          className="w-full"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Resume
                        </Button>
                      )}

                      {canCancel && (
                        <Button
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to cancel this tournament?",
                              )
                            ) {
                              onAction(tournament.id, "cancel");
                            }
                          }}
                          variant="danger"
                          size="sm"
                          className="w-full"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Cancel Tournament
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Pending approvals (host only) */}
                {isHost && pendingParticipants.length > 0 && (
                  <div className="bg-card border border-border">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
                        Pending
                      </h3>
                      <Badge variant="warning" size="sm">
                        {pendingParticipants.length}
                      </Badge>
                    </div>
                    <div className="divide-y divide-border">
                      {pendingParticipants.map((p) => (
                        <div
                          key={p.id}
                          className="px-4 py-2 flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-muted font-mono">
                              {p.address.slice(0, 8)}…
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                onApprove(tournament.id, p.id, "approve")
                              }
                              className="p-1 text-green-400 hover:shadow-[0_0_8px_rgba(74,222,128,0.4)] transition-shadow"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                onApprove(tournament.id, p.id, "reject")
                              }
                              className="p-1 text-red-400 hover:shadow-[0_0_8px_rgba(248,113,113,0.4)] transition-shadow"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* My stats */}
                {myParticipant &&
                  (tournament.status === "running" ||
                    tournament.status === "final_table") && (
                    <div className="bg-card border border-border p-4 space-y-2">
                      <h3 className="text-xs text-muted uppercase tracking-wider font-medium mb-2">
                        My Stats
                      </h3>
                      <InfoRow
                        label="Stack"
                        value={myParticipant.stack.toLocaleString()}
                      />
                      <InfoRow
                        label="Hands Played"
                        value={String(myParticipant.handsPlayed)}
                      />
                      <InfoRow
                        label="Hands Won"
                        value={String(myParticipant.handsWon)}
                      />
                      <InfoRow
                        label="Biggest Pot"
                        value={myParticipant.biggestPot.toLocaleString()}
                      />
                      {myParticipant.reentryCount > 0 && (
                        <InfoRow
                          label="Re-entries"
                          value={String(myParticipant.reentryCount)}
                        />
                      )}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* ──── Participants Tab ──── */}
          {activeTab === "participants" && (
            <div className="space-y-4 animate-fade-in-up">
              {/* Active / Playing */}
              <ParticipantSection
                title={
                  tournament.status === "running" ||
                  tournament.status === "final_table"
                    ? "Playing"
                    : "Registered"
                }
                participants={
                  tournament.status === "running" ||
                  tournament.status === "final_table"
                    ? playingParticipants.sort((a, b) => b.stack - a.stack)
                    : activeParticipants
                }
                showStack={
                  tournament.status === "running" ||
                  tournament.status === "final_table"
                }
                currentAddress={currentAddress}
              />

              {/* Eliminated */}
              {eliminatedParticipants.length > 0 && (
                <ParticipantSection
                  title="Eliminated"
                  participants={eliminatedParticipants}
                  showStack={false}
                  currentAddress={currentAddress}
                  dimmed
                />
              )}

              {/* Pending (host only) */}
              {isHost && pendingParticipants.length > 0 && (
                <ParticipantSection
                  title="Pending Approval"
                  participants={pendingParticipants}
                  showStack={false}
                  currentAddress={currentAddress}
                  isHost={isHost}
                  onApprove={(pid, action) =>
                    onApprove(tournament.id, pid, action)
                  }
                />
              )}
            </div>
          )}

          {/* ──── Structure Tab ──── */}
          {activeTab === "structure" && (
            <div className="space-y-4 animate-fade-in-up">
              <BlindScheduleTable
                blindLevels={tournament.structure.blindLevels}
                currentLevel={tournament.currentBlindLevel}
                breakAfterLevels={tournament.structure.breakAfterLevels}
              />
            </div>
          )}

          {/* ──── Results Tab ──── */}
          {activeTab === "results" && tournament.results.length > 0 && (
            <div className="space-y-1 animate-fade-in-up">
              {tournament.results
                .sort((a, b) => a.position - b.position)
                .map((result) => {
                  const isMe = result.address === currentAddress;
                  return (
                    <div
                      key={result.participantId}
                      className={`flex items-center justify-between px-4 py-3 border border-border ${
                        isMe ? "bg-primary/5 border-primary/20" : "bg-card"
                      } ${result.position <= 3 ? "border-l-2" : ""} ${
                        result.position === 1
                          ? "border-l-yellow-400"
                          : result.position === 2
                            ? "border-l-gray-300"
                            : result.position === 3
                              ? "border-l-amber-600"
                              : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center">
                          {result.position === 1 && (
                            <Crown className="w-5 h-5 text-yellow-400" />
                          )}
                          {result.position === 2 && (
                            <Medal className="w-5 h-5 text-gray-300" />
                          )}
                          {result.position === 3 && (
                            <Medal className="w-5 h-5 text-amber-600" />
                          )}
                          {result.position > 3 && (
                            <span className="text-sm text-muted font-mono">
                              #{result.position}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}
                          >
                            {result.name}
                            {isMe && (
                              <span className="text-xs text-muted ml-1">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted font-mono">
                            {result.address.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {result.prizeAmount > 0 ? (
                          <span className="font-mono text-sm text-yellow-400 font-semibold">
                            +{result.prizeAmount} OCT
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                        <p className="text-[10px] text-muted">
                          {result.handsPlayed} hands
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border p-3 flex items-center gap-3">
      <div className="text-muted">{icon}</div>
      <div>
        <div className="font-mono text-sm text-foreground font-semibold">
          {value}
        </div>
        <div className="text-[10px] text-muted uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted text-xs">{label}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

function ParticipantSection({
  title,
  participants,
  showStack,
  currentAddress,
  dimmed,
  isHost,
  onApprove,
}: {
  title: string;
  participants: TournamentParticipant[];
  showStack: boolean;
  currentAddress?: string;
  dimmed?: boolean;
  isHost?: boolean;
  onApprove?: (participantId: string, action: "approve" | "reject") => void;
}) {
  return (
    <div className="bg-card border border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-xs text-muted font-mono">
          {participants.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {participants.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted">
            No players
          </div>
        )}
        {participants.map((p, i) => {
          const isMe = p.address === currentAddress;
          const pStatus = participantStatusConfig[p.status];
          return (
            <div
              key={p.id}
              className={`px-4 py-2.5 flex items-center justify-between ${
                dimmed ? "opacity-60" : ""
              } ${isMe ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-muted font-mono w-5 text-right shrink-0">
                  {showStack ? i + 1 : ""}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm truncate ${isMe ? "text-primary font-medium" : "text-foreground"}`}
                  >
                    {p.name}
                    {isMe && (
                      <span className="text-[10px] text-muted ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted font-mono">
                    {p.address.slice(0, 8)}…
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {showStack && (
                  <span className="font-mono text-sm text-foreground">
                    {p.stack.toLocaleString()}
                  </span>
                )}
                {!showStack && (
                  <Badge variant={pStatus.variant} size="sm">
                    {pStatus.label}
                  </Badge>
                )}
                {isHost && onApprove && p.status === "pending" && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => onApprove(p.id, "approve")}
                      className="p-1 text-green-400 hover:shadow-[0_0_8px_rgba(74,222,128,0.4)] transition-shadow"
                      title="Approve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onApprove(p.id, "reject")}
                      className="p-1 text-red-400 hover:shadow-[0_0_8px_rgba(248,113,113,0.4)] transition-shadow"
                      title="Reject"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {p.finishPosition && (
                  <span className="text-xs text-muted font-mono">
                    #{p.finishPosition}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlindScheduleTable({
  blindLevels,
  currentLevel,
  breakAfterLevels,
}: {
  blindLevels: BlindLevel[];
  currentLevel: number;
  breakAfterLevels: number;
}) {
  return (
    <div className="border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-5 gap-1 px-4 py-2 bg-secondary/50 text-xs text-muted font-medium uppercase tracking-wider">
        <span>Level</span>
        <span>Small Blind</span>
        <span>Big Blind</span>
        <span>Ante</span>
        <span>Duration</span>
      </div>
      {/* Rows */}
      {blindLevels.map((bl, i) => {
        const isCurrent = i === currentLevel;
        const isPast = i < currentLevel;
        const showBreak =
          breakAfterLevels > 0 &&
          (i + 1) % breakAfterLevels === 0 &&
          i < blindLevels.length - 1;

        return (
          <div key={i}>
            <div
              className={`grid grid-cols-5 gap-1 px-4 py-2 border-t border-border text-sm ${
                isCurrent
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : isPast
                    ? "opacity-40"
                    : ""
              }`}
            >
              <span
                className={`font-mono ${isCurrent ? "text-primary font-semibold" : "text-foreground"}`}
              >
                {bl.level}
                {isCurrent && (
                  <span className="text-[10px] text-primary ml-1">●</span>
                )}
              </span>
              <span className="font-mono text-foreground">
                {bl.smallBlind.toLocaleString()}
              </span>
              <span className="font-mono text-foreground">
                {bl.bigBlind.toLocaleString()}
              </span>
              <span className="font-mono text-foreground">
                {bl.ante > 0 ? bl.ante.toLocaleString() : "—"}
              </span>
              <span className="font-mono text-muted">
                {bl.durationMinutes}m
              </span>
            </div>
            {showBreak && (
              <div className="px-4 py-1.5 bg-blue-500/5 border-t border-blue-500/20 text-[10px] text-blue-400 uppercase tracking-wider font-medium text-center">
                ☕ Break
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
