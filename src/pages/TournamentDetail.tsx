import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { useSocket } from "@/hooks/useSocket";
import { TournamentLobby } from "@/components/tournament";
import { Loader2, Trophy } from "lucide-react";

export function TournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  const { connected, connection, currentTournament, username } = useStore();

  const {
    getTournamentState,
    joinTournament,
    tournamentAction,
    approveTournamentParticipant,
    requestTournamentReentry,
  } = useSocket();

  // Fetch tournament state on mount and when ID changes
  useEffect(() => {
    if (connected && tournamentId) {
      getTournamentState(tournamentId);
    }
  }, [connected, tournamentId, getTournamentState]);

  // Poll for updates while viewing
  useEffect(() => {
    if (!connected || !tournamentId) return;
    const interval = setInterval(() => {
      getTournamentState(tournamentId);
    }, 5000);
    return () => clearInterval(interval);
  }, [connected, tournamentId, getTournamentState]);

  // ── Not connected ──
  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="text-center animate-fade-in">
          <Trophy className="w-12 h-12 text-muted mx-auto mb-4 opacity-40" />
          <p className="text-muted">
            Please connect your wallet to view this tournament
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (!currentTournament || currentTournament.id !== tournamentId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-8 h-8 text-muted mx-auto mb-4 animate-spin" />
          <p className="text-muted text-sm">Loading tournament…</p>
        </div>
      </div>
    );
  }

  // ── Handlers ──
  const handleBack = () => {
    navigate("/tournaments");
  };

  const handleJoin = (tid: string, address: string, name: string) => {
    joinTournament({ tournamentId: tid, address, name });
  };

  const handleAction = (
    tid: string,
    action: "start" | "pause" | "resume" | "cancel",
  ) => {
    tournamentAction({ tournamentId: tid, action });
  };

  const handleApprove = (
    tid: string,
    participantId: string,
    action: "approve" | "reject",
  ) => {
    approveTournamentParticipant({
      tournamentId: tid,
      participantId,
      action,
    });
  };

  const handleReentry = (tid: string) => {
    requestTournamentReentry(tid);
  };

  const handleNavigateToTable = (tableId: string) => {
    navigate(`/table/${tableId}`);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      <TournamentLobby
        tournament={currentTournament}
        currentAddress={connection?.walletPubKey}
        username={username ?? undefined}
        onBack={handleBack}
        onJoin={handleJoin}
        onAction={handleAction}
        onApprove={handleApprove}
        onReentry={handleReentry}
        onNavigateToTable={handleNavigateToTable}
      />
    </div>
  );
}
