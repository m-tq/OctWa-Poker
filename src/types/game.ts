// Card types
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";
export type Suit = "C" | "D" | "H" | "S";

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Player types
export type PlayerStatus =
  | "active"
  | "folded"
  | "all-in"
  | "sitting-out"
  | "away"
  | "quitting"
  | "in-next-hand";

export interface Player {
  id: string;
  address: string;
  name: string;
  stack: number;
  holeCards: Card[] | null;
  bet: number;
  status: PlayerStatus;
  seatIndex: number;
  isConnected: boolean;
  avatarUrl?: string;
}

// Table types
export type TableMode = "cash" | "tournament";

export interface WaitlistEntry {
  playerId: string;
  address: string;
  name: string;
  requestedAt: number;
  notifyOnSeat: boolean;
}

export interface Table {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  players: (Player | null)[];
  currentHand: Hand | null;
  createdBy?: string;
  creatorAddress?: string;
  mode: TableMode;
  tournamentId?: string;
  tableNumber?: number;
  waitlistCount: number;
  handCount: number;
}

// Hand types
export type HandStage = "preflop" | "flop" | "turn" | "river" | "showdown";

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface Hand {
  id: string;
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  currentBet: number;
  dealerIndex: number;
  activePlayerIndex: number;
  stage: HandStage;
  actions: Action[];
  turnStartedAt: number;
  smallBlindPlayerId: string;
  bigBlindPlayerId: string;
}

// Action types
export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "all-in";

export interface Action {
  playerId: string;
  type: ActionType;
  amount?: number;
  timestamp: number;
}

// Hand evaluation types
export type HandRank =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush"
  | "royal-flush";

export interface EvaluatedHand {
  rank: HandRank;
  rankValue: number; // 1-10 for comparison
  name: string;
  cards: Card[];
  score: number; // For tie-breaking within same rank
}

// Result types
export interface HandResult {
  winners: {
    playerId: string;
    amount: number;
    hand: EvaluatedHand;
  }[];
  showdown: {
    playerId: string;
    holeCards: Card[];
    hand: EvaluatedHand;
  }[];
}

// Available actions for a player
export interface AvailableActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  canAllIn: boolean;
  callAmount: number;
  minBet: number;
  minRaise: number;
  maxRaise: number;
}

// ============================================================
// Chat / Live Log types
// ============================================================

export type ChatMessageType = "player" | "system" | "notification" | "dealer";

export interface ChatMessage {
  id: string;
  tableId: string;
  type: ChatMessageType;
  senderId?: string;
  senderName?: string;
  content: string;
  timestamp: number;
}

// Table log entries (like PokerNow's log/ledger)
export type LogEntryType =
  | "player_joined"
  | "player_left"
  | "player_busted"
  | "hand_started"
  | "hand_ended"
  | "blinds_posted"
  | "player_action"
  | "community_cards"
  | "showdown"
  | "pot_awarded"
  | "stack_change"
  | "dealer_button"
  | "tournament_update";

export interface LogEntry {
  id: string;
  tableId: string;
  type: LogEntryType;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// ============================================================
// Tournament types (Multi-Table Tournament - MTT)
// ============================================================

export type TournamentStatus =
  | "registering"
  | "pending"
  | "running"
  | "paused"
  | "final_table"
  | "completed"
  | "cancelled";

export type TournamentParticipantStatus =
  | "registered"
  | "pending"
  | "approved"
  | "playing"
  | "eliminated"
  | "reentry_requested"
  | "withdrawn";

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
}

export interface TournamentStructure {
  startingStack: number;
  blindLevels: BlindLevel[];
  blindLevelDurationMinutes: number;
  // Break settings
  breakAfterLevels: number;
  breakDurationMinutes: number;
  // Table settings
  maxPlayersPerTable: number;
  minPlayersPerTable: number;
  // Registration settings
  lateRegistrationLevels: number;
  allowReentry: boolean;
  maxReentries: number;
  reentryDeadlineLevel: number;
  // Prize structure
  payoutPercentages: number[];
  // Buy-in
  buyInAmount: number;
  // Timing
  handTimeoutSeconds: number;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  userId: string;
  address: string;
  name: string;
  status: TournamentParticipantStatus;
  tableId?: string;
  seatIndex?: number;
  stack: number;
  reentryCount: number;
  finishPosition?: number;
  prizeAmount?: number;
  registeredAt: number;
  eliminatedAt?: number;
  handsPlayed: number;
  handsWon: number;
  biggestPot: number;
}

export interface Tournament {
  id: string;
  name: string;
  hostId: string;
  hostAddress: string;
  status: TournamentStatus;
  structure: TournamentStructure;
  participants: TournamentParticipant[];
  maxParticipants: number;
  tableIds: string[];
  currentBlindLevel: number;
  blindLevelStartedAt: number;
  nextBlindLevelAt: number;
  isOnBreak: boolean;
  breakEndsAt?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  pausedAt?: number;
  totalPausedMs: number;
  totalPrizePool: number;
  inviteToken: string;
  results: TournamentResult[];
}

export interface TournamentResult {
  position: number;
  participantId: string;
  userId: string;
  address: string;
  name: string;
  prizeAmount: number;
  handsPlayed: number;
}

// ============================================================
// Leaderboard entry
// ============================================================

export interface LeaderboardEntry {
  address: string;
  name: string;
  handsPlayed: number;
  handsWon: number;
  totalWinnings: number;
  netProfit: number;
}
