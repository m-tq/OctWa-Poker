import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useStore } from "@/store";
import { WS_URL, API_URL } from "@/config";
import type {
  Table,
  Player,
  Action,
  HandResult,
  Card,
  HandStage,
  ChatMessage,
  LogEntry,
  Tournament,
  TournamentParticipant,
} from "@/types/game";

type JoinCallback = (success: boolean, error?: string) => void;
type HandEndedCallback = (result: HandResult) => void;

// Global callback ref for hand ended (to avoid re-creating socket)
let handEndedCallbackRef: HandEndedCallback | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const joinCallbackRef = useRef<JoinCallback | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastHandResult, setLastHandResult] = useState<HandResult | null>(null);

  const {
    setSocketConnected,
    setTables,
    addTable,
    removeTable,
    setCurrentTable,
    setCurrentHand,
    setMyHoleCards,
    setLastTableSession,
    setGameWalletEnabled,
    lastTableSession,
    currentTable,
    addError,
    connection,
    // Chat & Log
    addChatMessage,
    addLogEntry,
    clearChat,
    clearLog,
    // Waitlist
    setIsOnWaitlist,
    setWaitlistPosition,
    // Tournament
    setTournaments,
    addTournament,
    updateTournament,
    removeTournament,
    setCurrentTournament,
    setMyTournamentParticipant,
  } = useStore();

  // Use refs for values needed in socket handlers to avoid re-creating socket
  const lastTableSessionRef = useRef(lastTableSession);
  const currentTableRef = useRef(currentTable);
  const connectionRef = useRef(connection);

  useEffect(() => {
    lastTableSessionRef.current = lastTableSession;
  }, [lastTableSession]);

  useEffect(() => {
    currentTableRef.current = currentTable;
  }, [currentTable]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  // Helper to clear join state
  const clearJoinState = useCallback(() => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    joinCallbackRef.current = null;
    setIsJoining(false);
  }, []);

  // Initialize socket connection - only run once
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Local helper to clear join state
    const clearJoin = () => {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      joinCallbackRef.current = null;
      setIsJoining(false);
    };

    // ======================================================================
    // Connection lifecycle
    // ======================================================================

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      setSocketConnected(true);
      setIsReconnecting(false);
      socket.emit("get-tables");

      // Fetch server config (including gameWalletEnabled)
      fetch(`${API_URL}/api/config`)
        .then((res) => res.json())
        .then((config) => {
          console.log("[Socket] Server config:", config);
          setGameWalletEnabled(config.gameWalletEnabled || false);
        })
        .catch((err) => console.error("[Socket] Failed to fetch config:", err));

      // Auto-rejoin if we have a persisted session
      const session = lastTableSessionRef.current;
      const conn = connectionRef.current;
      if (session && conn?.walletPubKey) {
        console.log(
          "[Socket] Attempting auto-rejoin to table:",
          session.tableId,
        );
        socket.emit("rejoin-table", {
          tableId: session.tableId,
          address: session.address,
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setSocketConnected(false);
      clearJoin();
      if (reason !== "io client disconnect") {
        setIsReconnecting(true);
      }
    });

    socket.on("reconnect_attempt", (attempt: number) => {
      console.log("[Socket] Reconnection attempt:", attempt);
      setIsReconnecting(true);
    });

    socket.on("reconnect_failed", () => {
      console.log("[Socket] Reconnection failed");
      setIsReconnecting(false);
      addError("SOCKET_ERROR", "Failed to reconnect to game server");
    });

    socket.on("connect_error", (error: Error) => {
      console.error("[Socket] Connection error:", error);
    });

    // ======================================================================
    // Table events
    // ======================================================================

    socket.on("tables-list", (tables: Table[]) => {
      setTables(tables);
    });

    socket.on("table-created", (table: Table) => {
      addTable(table);
    });

    socket.on("table-removed", ({ tableId }: { tableId: string }) => {
      removeTable(tableId);
    });

    socket.on("table-state", (table: Table) => {
      console.log("[Socket] Table state received:", table.id);
      setCurrentTable(table);
      if (table.currentHand) {
        setCurrentHand(table.currentHand);
      }
      // Call join callback if waiting
      if (joinCallbackRef.current) {
        console.log("[Socket] Calling join callback with success");
        joinCallbackRef.current(true);
        clearJoin();
      }
    });

    // ======================================================================
    // Rejoin events
    // ======================================================================

    socket.on(
      "rejoin-success",
      ({ table, yourCards }: { table: Table; yourCards?: Card[] }) => {
        console.log("[Socket] Rejoin successful");
        setCurrentTable(table);
        if (table.currentHand) {
          setCurrentHand(table.currentHand);
        }
        if (yourCards) {
          setMyHoleCards(yourCards);
        }
        clearJoin();
      },
    );

    socket.on("rejoin-failed", ({ message }: { message: string }) => {
      console.log("[Socket] Rejoin failed:", message);
      setLastTableSession(null);
      setCurrentTable(null);
      clearJoin();
    });

    // ======================================================================
    // Player events
    // ======================================================================

    socket.on(
      "player-joined",
      ({ player, seatIndex }: { player: Player; seatIndex: number }) => {
        console.log(
          "[Socket] Player joined:",
          player.name,
          "at seat",
          seatIndex,
        );
      },
    );

    socket.on(
      "player-left",
      ({ playerId, seatIndex }: { playerId: string; seatIndex: number }) => {
        console.log("[Socket] Player left:", playerId, "from seat", seatIndex);
      },
    );

    socket.on(
      "player-disconnected",
      ({ playerId, seatIndex }: { playerId: string; seatIndex: number }) => {
        console.log(
          "[Socket] Player disconnected:",
          playerId,
          "from seat",
          seatIndex,
        );
      },
    );

    socket.on(
      "player-reconnected",
      ({ playerId, seatIndex }: { playerId: string; seatIndex: number }) => {
        console.log(
          "[Socket] Player reconnected:",
          playerId,
          "at seat",
          seatIndex,
        );
      },
    );

    // ======================================================================
    // Hand events
    // ======================================================================

    socket.on(
      "hand-started",
      ({ hand, yourCards }: { hand: any; yourCards?: Card[] }) => {
        setCurrentHand(hand);
        if (yourCards) {
          setMyHoleCards(yourCards);
        }
      },
    );

    socket.on(
      "community-cards",
      ({ cards, stage }: { cards: Card[]; stage: HandStage }) => {
        console.log("[Socket] Community cards:", stage, cards);
      },
    );

    socket.on(
      "player-acted",
      ({ playerId, action }: { playerId: string; action: Action }) => {
        console.log(
          "[Socket] Player acted:",
          playerId,
          action.type,
          action.amount,
        );
      },
    );

    socket.on(
      "turn-changed",
      ({
        playerId,
        timeRemaining,
      }: {
        playerId: string;
        timeRemaining: number;
      }) => {
        console.log(
          "[Socket] Turn changed to:",
          playerId,
          "time:",
          timeRemaining,
        );
      },
    );

    socket.on("hand-ended", ({ result }: { result: HandResult }) => {
      console.log("[Socket] Hand ended:", result);
      setLastHandResult(result);
      setMyHoleCards(null);
      if (handEndedCallbackRef) {
        handEndedCallbackRef(result);
      }
    });

    socket.on(
      "player-busted",
      ({ playerId, message }: { playerId: string; message: string }) => {
        console.log("[Socket] Player busted:", playerId, message);
        addError("PLAYER_BUSTED", message);
        setLastTableSession(null);
        setCurrentTable(null);
        setCurrentHand(null);
        setMyHoleCards(null);
      },
    );

    socket.on(
      "waiting-for-players",
      ({
        message,
        currentPlayers,
        required,
      }: {
        message: string;
        currentPlayers: number;
        required: number;
      }) => {
        console.log(
          "[Socket] Waiting for players:",
          message,
          currentPlayers,
          "/",
          required,
        );
      },
    );

    socket.on(
      "stack-updated",
      ({ playerId, stack }: { playerId: string; stack: number }) => {
        console.log("[Socket] Stack updated:", playerId, stack);
      },
    );

    socket.on("table-deleted", ({ tableId }: { tableId: string }) => {
      console.log("[Socket] Table deleted:", tableId);
      removeTable(tableId);
      if (currentTableRef.current?.id === tableId) {
        setCurrentTable(null);
        setCurrentHand(null);
        setMyHoleCards(null);
        setLastTableSession(null);
        clearChat();
        clearLog();
        addError("TABLE_DELETED", "This table has been deleted by the owner");
      }
    });

    // ======================================================================
    // Chat & Log events
    // ======================================================================

    socket.on("chat-message", (message: ChatMessage) => {
      addChatMessage(message);
    });

    socket.on("log-entry", (entry: LogEntry) => {
      addLogEntry(entry);
    });

    // Batch: receive recent history when joining a table
    socket.on(
      "chat-history",
      ({
        messages,
        entries,
      }: {
        messages: ChatMessage[];
        entries: LogEntry[];
      }) => {
        if (messages && messages.length > 0) {
          messages.forEach((m) => addChatMessage(m));
        }
        if (entries && entries.length > 0) {
          entries.forEach((e) => addLogEntry(e));
        }
      },
    );

    // ======================================================================
    // Waitlist events
    // ======================================================================

    socket.on(
      "waitlist-update",
      ({
        tableId,
        waitlistCount,
        position,
      }: {
        tableId: string;
        waitlistCount: number;
        position?: number;
      }) => {
        console.log(
          "[Socket] Waitlist update:",
          tableId,
          "count:",
          waitlistCount,
          "position:",
          position,
        );
        if (position !== undefined) {
          setWaitlistPosition(position);
          setIsOnWaitlist(true);
        }
      },
    );

    socket.on(
      "waitlist-seated",
      ({ tableId, seatIndex }: { tableId: string; seatIndex: number }) => {
        console.log(
          "[Socket] Seated from waitlist at:",
          tableId,
          "seat:",
          seatIndex,
        );
        setIsOnWaitlist(false);
        setWaitlistPosition(null);
      },
    );

    socket.on("waitlist-removed", () => {
      setIsOnWaitlist(false);
      setWaitlistPosition(null);
    });

    // ======================================================================
    // Tournament events
    // ======================================================================

    socket.on("tournaments-list", (tournaments: Tournament[]) => {
      setTournaments(tournaments);
    });

    socket.on("tournament-created", (tournament: Tournament) => {
      addTournament(tournament);
    });

    socket.on("tournament-updated", (tournament: Tournament) => {
      updateTournament(tournament.id, tournament);
    });

    socket.on(
      "tournament-removed",
      ({ tournamentId }: { tournamentId: string }) => {
        removeTournament(tournamentId);
      },
    );

    socket.on("tournament-state", (tournament: Tournament) => {
      setCurrentTournament(tournament);
    });

    socket.on(
      "tournament-participant-update",
      (participant: TournamentParticipant) => {
        setMyTournamentParticipant(participant);
      },
    );

    socket.on(
      "tournament-table-assignment",
      ({
        tournamentId,
        tableId,
        seatIndex,
      }: {
        tournamentId: string;
        tableId: string;
        seatIndex: number;
      }) => {
        console.log(
          "[Socket] Tournament table assignment:",
          tournamentId,
          tableId,
          "seat:",
          seatIndex,
        );
        // Auto-navigate: the Table page will pick up the currentTable from store
      },
    );

    socket.on(
      "tournament-blind-level",
      ({
        tournamentId,
        level,
        smallBlind,
        bigBlind,
        ante,
      }: {
        tournamentId: string;
        level: number;
        smallBlind: number;
        bigBlind: number;
        ante: number;
        nextLevelAt: number;
      }) => {
        console.log(
          `[Socket] Tournament ${tournamentId} blind level ${level}: ${smallBlind}/${bigBlind} ante ${ante}`,
        );
      },
    );

    socket.on(
      "tournament-break",
      ({ tournamentId, endsAt }: { tournamentId: string; endsAt: number }) => {
        console.log(
          `[Socket] Tournament ${tournamentId} break until ${new Date(endsAt).toLocaleTimeString()}`,
        );
      },
    );

    socket.on(
      "tournament-completed",
      ({ tournamentId, results }: { tournamentId: string; results: any[] }) => {
        console.log(
          `[Socket] Tournament ${tournamentId} completed, results:`,
          results,
        );
      },
    );

    // ======================================================================
    // Error events
    // ======================================================================

    socket.on(
      "error",
      ({ code, message }: { code: string; message: string }) => {
        console.error("[Socket] Error:", code, message);
        addError(code, message);
        // Call join callback with error if waiting
        if (
          joinCallbackRef.current &&
          (code === "JOIN_FAILED" || code === "NOT_AT_TABLE")
        ) {
          joinCallbackRef.current(false, message);
          clearJoin();
        }
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // ======================================================================
  // Socket action dispatchers
  // ======================================================================

  // ---- Table actions ----

  const createTable = useCallback(
    (data: {
      name: string;
      smallBlind: number;
      bigBlind: number;
      minBuyIn: number;
      maxBuyIn: number;
      maxPlayers: number;
      creatorAddress?: string;
    }) => {
      socketRef.current?.emit("create-table", data);
    },
    [],
  );

  const deleteTable = useCallback((tableId: string, address: string) => {
    socketRef.current?.emit("delete-table", { tableId, address });
  }, []);

  const startGame = useCallback((tableId: string, address: string) => {
    socketRef.current?.emit("start-game", { tableId, address });
  }, []);

  const joinTable = useCallback(
    (
      data: {
        tableId: string;
        buyIn: number;
        seatIndex: number;
        address: string;
        name: string;
        escrowSessionId?: string;
      },
      callback?: JoinCallback,
    ) => {
      // Clear any existing join state first
      clearJoinState();

      setIsJoining(true);
      if (callback) {
        joinCallbackRef.current = callback;
      }

      // Store session for auto-rejoin (persisted to localStorage)
      setLastTableSession({
        tableId: data.tableId,
        address: data.address,
        name: data.name,
      });

      // Clear previous chat/log for fresh table
      clearChat();
      clearLog();

      socketRef.current?.emit("join-table", data);

      // Timeout after 10 seconds
      joinTimeoutRef.current = setTimeout(() => {
        if (joinCallbackRef.current) {
          joinCallbackRef.current(false, "Join timeout");
          clearJoinState();
        }
      }, 10000);
    },
    [setLastTableSession, clearJoinState, clearChat, clearLog],
  );

  const leaveTable = useCallback(
    (tableId: string) => {
      setLastTableSession(null);
      socketRef.current?.emit("leave-table", { tableId });
      setCurrentTable(null);
      setCurrentHand(null);
      setMyHoleCards(null);
      clearChat();
      clearLog();
      setIsOnWaitlist(false);
      setWaitlistPosition(null);
    },
    [
      setCurrentTable,
      setCurrentHand,
      setMyHoleCards,
      setLastTableSession,
      clearChat,
      clearLog,
      setIsOnWaitlist,
      setWaitlistPosition,
    ],
  );

  const sendAction = useCallback(
    (tableId: string, action: string, amount?: number) => {
      socketRef.current?.emit("player-action", { tableId, action, amount });
    },
    [],
  );

  const refreshTables = useCallback(() => {
    socketRef.current?.emit("get-tables");
  }, []);

  // Manual rejoin (for Table page on reload)
  const rejoinTable = useCallback((tableId: string, address: string) => {
    socketRef.current?.emit("rejoin-table", { tableId, address });
  }, []);

  // ---- Chat actions ----

  const sendChatMessage = useCallback((tableId: string, content: string) => {
    if (!content.trim()) return;
    socketRef.current?.emit("send-chat", { tableId, content: content.trim() });
  }, []);

  // ---- Waitlist actions ----

  const joinWaitlist = useCallback((tableId: string) => {
    socketRef.current?.emit("join-waitlist", { tableId });
  }, []);

  const leaveWaitlist = useCallback(
    (tableId: string) => {
      socketRef.current?.emit("leave-waitlist", { tableId });
      setIsOnWaitlist(false);
      setWaitlistPosition(null);
    },
    [setIsOnWaitlist, setWaitlistPosition],
  );

  // ---- Tournament actions ----

  const createTournament = useCallback(
    (data: { name: string; structure: any; maxParticipants: number }) => {
      socketRef.current?.emit("create-tournament", data);
    },
    [],
  );

  const getTournaments = useCallback(() => {
    socketRef.current?.emit("get-tournaments");
  }, []);

  const joinTournament = useCallback(
    (data: { tournamentId: string; address: string; name: string }) => {
      socketRef.current?.emit("join-tournament", data);
    },
    [],
  );

  const tournamentAction = useCallback(
    (data: {
      tournamentId: string;
      action: "start" | "pause" | "resume" | "cancel";
    }) => {
      socketRef.current?.emit("tournament-action", data);
    },
    [],
  );

  const approveTournamentParticipant = useCallback(
    (data: {
      tournamentId: string;
      participantId: string;
      action: "approve" | "reject";
      customStack?: number;
    }) => {
      socketRef.current?.emit("tournament-approve", data);
    },
    [],
  );

  const requestTournamentReentry = useCallback((tournamentId: string) => {
    socketRef.current?.emit("tournament-reentry", { tournamentId });
  }, []);

  const getTournamentState = useCallback((tournamentId: string) => {
    socketRef.current?.emit("get-tournament", { tournamentId });
  }, []);

  // ---- Hand ended callback ----

  const onHandEnded = useCallback((callback: HandEndedCallback | null) => {
    handEndedCallbackRef = callback;
  }, []);

  const clearLastHandResult = useCallback(() => {
    setLastHandResult(null);
  }, []);

  // ======================================================================
  // Return
  // ======================================================================

  return {
    socket: socketRef.current,
    isJoining,
    isReconnecting,
    lastHandResult,

    // Table actions
    createTable,
    deleteTable,
    startGame,
    joinTable,
    leaveTable,
    sendAction,
    refreshTables,
    rejoinTable,

    // Chat actions
    sendChatMessage,

    // Waitlist actions
    joinWaitlist,
    leaveWaitlist,

    // Tournament actions
    createTournament,
    getTournaments,
    joinTournament,
    tournamentAction,
    approveTournamentParticipant,
    requestTournamentReentry,
    getTournamentState,

    // Hand ended
    onHandEnded,
    clearLastHandResult,
  };
}
