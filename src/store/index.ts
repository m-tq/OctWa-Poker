import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Connection, Capability } from '@octwa/sdk';
import type { Table, Hand, Player, Card } from '@/types/game';

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

interface Store {
  // Wallet Connection
  connected: boolean;
  connection: Connection | null;
  capability: Capability | null;
  octBalance: number | null;
  balanceLoading: boolean;

  // User Profile
  username: string | null;
  userStats: UserStats | null;
  showUsernameSetup: boolean;

  // Lobby
  tables: Table[];
  tablesLoading: boolean;

  // Server Config
  gameWalletEnabled: boolean;

  // Current Game
  currentTable: Table | null;
  currentHand: Hand | null;
  myPlayer: Player | null;
  myHoleCards: Card[] | null;
  
  // Session for auto-rejoin
  lastTableSession: TableSession | null;

  // Socket
  socketConnected: boolean;

  // Errors
  errors: AppError[];

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

const initialState = {
  connected: false,
  connection: null,
  capability: null,
  octBalance: null,
  balanceLoading: false,
  username: null,
  userStats: null,
  showUsernameSetup: false,
  tables: [],
  tablesLoading: false,
  gameWalletEnabled: false,
  currentTable: null,
  currentHand: null,
  myPlayer: null,
  myHoleCards: null,
  lastTableSession: null,
  socketConnected: false,
  errors: [],
  _hasHydrated: false,
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...initialState,

      // Wallet Actions
      setConnection: (conn) =>
        set({
          connected: conn !== null,
          connection: conn,
        }),

      setCapability: (cap) => set({ capability: cap }),

      setOctBalance: (balance) => set({ octBalance: balance }),

      setBalanceLoading: (loading) => set({ balanceLoading: loading }),

      // User Profile Actions
      setUsername: (username) => set({ username }),
      setUserStats: (stats) => set({ userStats: stats }),
      setShowUsernameSetup: (show) => set({ showUsernameSetup: show }),

      // Lobby Actions
      setTables: (tables) => set({ tables }),

      setTablesLoading: (loading) => set({ tablesLoading: loading }),

      addTable: (table) =>
        set((state) => ({
          tables: [...state.tables, table],
        })),

      updateTable: (tableId, updates) =>
        set((state) => ({
          tables: state.tables.map((t) =>
            t.id === tableId ? { ...t, ...updates } : t
          ),
        })),

      removeTable: (tableId) =>
        set((state) => ({
          tables: state.tables.filter((t) => t.id !== tableId),
        })),

      // Server Config Actions
      setGameWalletEnabled: (enabled) => set({ gameWalletEnabled: enabled }),

      // Game Actions
      setCurrentTable: (table) => set({ currentTable: table }),

      setCurrentHand: (hand) => set({ currentHand: hand }),

      setMyPlayer: (player) => set({ myPlayer: player }),

      setMyHoleCards: (cards) => set({ myHoleCards: cards }),
      
      setLastTableSession: (session) => set({ lastTableSession: session }),

      // Socket Actions
      setSocketConnected: (connected) => set({ socketConnected: connected }),

      // Error Actions
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

      // Reset
      reset: () => set(initialState),

      // Hydration
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'oct-poker-storage',
      partialize: (state) => ({
        connection: state.connection,
        connected: state.connected,
        capability: state.capability,
        username: state.username,
        lastTableSession: state.lastTableSession,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
