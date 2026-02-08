import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Connection, Capability } from "@octwa/sdk";
import type {
  Table,
  Hand,
  Player,
  Card,
  ChatMessage,
  LogEntry,
  Tournament,
  TournamentParticipant,
} from "@/types/game";

// ============================================================
// Types
// ============================================================

interface AppError {
  id: string;
  code: string;
  message: string;
  timestamp: number;
}

// Session info for auto-rejoin
interface TableSession {
  tableId: string;
  address: string;
  name: string;
}

// User stats from server
interface UserStats {
  handsPlayed: number;
  handsWon: number;
  winRate: string;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
}

// ============================================================
// Store interface
// ============================================================

interface Store {
  // ---- Wallet Connection ----
  connected: boolean;
  connection: Connection | null;
  capability: Capability | null;
  octBalance: number | null;
  balanceLoading: boolean;

  // ---- User Profile ----
  username: string | null;
  userStats: UserStats | null;
  showUsernameSetup: boolean;

  // ---- Lobby ----
  tables: Table[];
  tablesLoading: boolean;

  // ---- Server Config ----
  gameWalletEnabled: boolean;

  // ---- Current Game ----
  currentTable: Table | null;
  currentHand: Hand | null;
  myPlayer: Player | null;
  myHoleCards: Card[] | null;

  // ---- Session for auto-rejoin ----
  lastTableSession: TableSession | null;

  // ---- Socket ----
  socketConnected: boolean;

  // ---- Chat & Log ----
  chatMessages: ChatMessage[];
  logEntries: LogEntry[];
  chatMuted: boolean;

  // ---- Waitlist ----
  isOnWaitlist: boolean;
  waitlistPosition: number | null;

  // ---- Tournament ----
  tournaments: Tournament[];
  tournamentsLoading: boolean;
  currentTournament: Tournament | null;
  myTournamentParticipant: TournamentParticipant | null;

  // ---- Errors ----
  errors: AppError[];

  // ============================================================
  // Actions
  // ============================================================

  // Wallet Actions
  setConnection: (conn: Connection | null) => void;
  setCapability: (cap: Capability | null) => void;
  setOctBalance: (balance: number | null) => void;
  setBalanceLoading: (loading: boolean) => void;

  // User Profile Actions
  setUsername: (username: string | null) => void;
  setUserStats: (stats: UserStats | null) => void;
  setShowUsernameSetup: (show: boolean) => void;

  // Lobby Actions
  setTables: (tables: Table[]) => void;
  setTablesLoading: (loading: boolean) => void;
  addTable: (table: Table) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  removeTable: (tableId: string) => void;

  // Server Config Actions
  setGameWalletEnabled: (enabled: boolean) => void;

  // Game Actions
  setCurrentTable: (table: Table | null) => void;
  setCurrentHand: (hand: Hand | null) => void;
  setMyPlayer: (player: Player | null) => void;
  setMyHoleCards: (cards: Card[] | null) => void;
  setLastTableSession: (session: TableSession | null) => void;

  // Socket Actions
  setSocketConnected: (connected: boolean) => void;

  // Chat & Log Actions
  addChatMessage: (message: ChatMessage) => void;
  addLogEntry: (entry: LogEntry) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setLogEntries: (entries: LogEntry[]) => void;
  clearChat: () => void;
  clearLog: () => void;
  setChatMuted: (muted: boolean) => void;

  // Waitlist Actions
  setIsOnWaitlist: (value: boolean) => void;
  setWaitlistPosition: (position: number | null) => void;

  // Tournament Actions
  setTournaments: (tournaments: Tournament[]) => void;
  setTournamentsLoading: (loading: boolean) => void;
  addTournament: (tournament: Tournament) => void;
  updateTournament: (id: string, updates: Partial<Tournament>) => void;
  removeTournament: (id: string) => void;
  setCurrentTournament: (tournament: Tournament | null) => void;
  setMyTournamentParticipant: (
    participant: TournamentParticipant | null,
  ) => void;

  // Error Actions
  addError: (code: string, message: string) => void;
  clearErrors: () => void;
  clearError: (code: string) => void;
  removeError: (id: string) => void;

  // Reset
  reset: () => void;

  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

// ============================================================
// Initial state
// ============================================================

const MAX_CHAT_MESSAGES = 500;
const MAX_LOG_ENTRIES = 1000;

const initialState = {
  // Wallet
  connected: false,
  connection: null,
  capability: null,
  octBalance: null,
  balanceLoading: false,

  // User
  username: null,
  userStats: null,
  showUsernameSetup: false,

  // Lobby
  tables: [],
  tablesLoading: false,

  // Config
  gameWalletEnabled: false,

  // Game
  currentTable: null,
  currentHand: null,
  myPlayer: null,
  myHoleCards: null,
  lastTableSession: null,

  // Socket
  socketConnected: false,

  // Chat & Log
  chatMessages: [],
  logEntries: [],
  chatMuted: false,

  // Waitlist
  isOnWaitlist: false,
  waitlistPosition: null,

  // Tournament
  tournaments: [],
  tournamentsLoading: false,
  currentTournament: null,
  myTournamentParticipant: null,

  // Errors
  errors: [],

  // Hydration
  _hasHydrated: false,
};

// ============================================================
// Store
// ============================================================

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...initialState,

      // ---- Wallet Actions ----
      setConnection: (conn) =>
        set({
          connected: conn !== null,
          connection: conn,
        }),

      setCapability: (cap) => set({ capability: cap }),

      setOctBalance: (balance) => set({ octBalance: balance }),

      setBalanceLoading: (loading) => set({ balanceLoading: loading }),

      // ---- User Profile Actions ----
      setUsername: (username) => set({ username }),
      setUserStats: (stats) => set({ userStats: stats }),
      setShowUsernameSetup: (show) => set({ showUsernameSetup: show }),

      // ---- Lobby Actions ----
      setTables: (tables) => set({ tables }),

      setTablesLoading: (loading) => set({ tablesLoading: loading }),

      addTable: (table) =>
        set((state) => ({
          tables: [...state.tables, table],
        })),

      updateTable: (tableId, updates) =>
        set((state) => ({
          tables: state.tables.map((t) =>
            t.id === tableId ? { ...t, ...updates } : t,
          ),
        })),

      removeTable: (tableId) =>
        set((state) => ({
          tables: state.tables.filter((t) => t.id !== tableId),
        })),

      // ---- Server Config Actions ----
      setGameWalletEnabled: (enabled) => set({ gameWalletEnabled: enabled }),

      // ---- Game Actions ----
      setCurrentTable: (table) => set({ currentTable: table }),

      setCurrentHand: (hand) => set({ currentHand: hand }),

      setMyPlayer: (player) => set({ myPlayer: player }),

      setMyHoleCards: (cards) => set({ myHoleCards: cards }),

      setLastTableSession: (session) => set({ lastTableSession: session }),

      // ---- Socket Actions ----
      setSocketConnected: (connected) => set({ socketConnected: connected }),

      // ---- Chat & Log Actions ----
      addChatMessage: (message) =>
        set((state) => {
          const updated = [...state.chatMessages, message];
          // Cap at max to prevent memory leak
          if (updated.length > MAX_CHAT_MESSAGES) {
            return { chatMessages: updated.slice(-MAX_CHAT_MESSAGES) };
          }
          return { chatMessages: updated };
        }),

      addLogEntry: (entry) =>
        set((state) => {
          const updated = [...state.logEntries, entry];
          if (updated.length > MAX_LOG_ENTRIES) {
            return { logEntries: updated.slice(-MAX_LOG_ENTRIES) };
          }
          return { logEntries: updated };
        }),

      setChatMessages: (messages) => set({ chatMessages: messages }),

      setLogEntries: (entries) => set({ logEntries: entries }),

      clearChat: () => set({ chatMessages: [] }),

      clearLog: () => set({ logEntries: [] }),

      setChatMuted: (muted) => set({ chatMuted: muted }),

      // ---- Waitlist Actions ----
      setIsOnWaitlist: (value) => set({ isOnWaitlist: value }),

      setWaitlistPosition: (position) => set({ waitlistPosition: position }),

      // ---- Tournament Actions ----
      setTournaments: (tournaments) => set({ tournaments }),

      setTournamentsLoading: (loading) => set({ tournamentsLoading: loading }),

      addTournament: (tournament) =>
        set((state) => ({
          tournaments: [...state.tournaments, tournament],
        })),

      updateTournament: (id, updates) =>
        set((state) => ({
          tournaments: state.tournaments.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
          // Also update currentTournament if it's the one being modified
          currentTournament:
            state.currentTournament?.id === id
              ? { ...state.currentTournament, ...updates }
              : state.currentTournament,
        })),

      removeTournament: (id) =>
        set((state) => ({
          tournaments: state.tournaments.filter((t) => t.id !== id),
          currentTournament:
            state.currentTournament?.id === id ? null : state.currentTournament,
        })),

      setCurrentTournament: (tournament) =>
        set({ currentTournament: tournament }),

      setMyTournamentParticipant: (participant) =>
        set({ myTournamentParticipant: participant }),

      // ---- Error Actions ----
      addError: (code, message) =>
        set((state) => ({
          errors: [
            ...state.errors,
            {
              id: crypto.randomUUID(),
              code,
              message,
              timestamp: Date.now(),
            },
          ],
        })),

      clearErrors: () => set({ errors: [] }),

      clearError: (code) =>
        set((state) => ({
          errors: state.errors.filter((e) => e.code !== code),
        })),

      removeError: (id) =>
        set((state) => ({
          errors: state.errors.filter((e) => e.id !== id),
        })),

      // ---- Reset ----
      reset: () => set(initialState),

      // ---- Hydration ----
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "oct-poker-storage",
      partialize: (state) => ({
        // Only persist essential session data
        connection: state.connection,
        connected: state.connected,
        capability: state.capability,
        username: state.username,
        lastTableSession: state.lastTableSession,
        chatMuted: state.chatMuted,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
