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
  socketId: string;
  avatarUrl?: string;
  // Timestamps for idle detection
  lastActionAt: number;
  joinedAt: number;
}

// Table types
export type TableMode = "cash" | "tournament";

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
  createdBy?: string; // userId of the creator
  creatorAddress?: string; // wallet address of the creator
  mode: TableMode;
  tournamentId?: string; // linked tournament if mode === 'tournament'
  tableNumber?: number; // table number within tournament
  // Waitlist
  waitlist: WaitlistEntry[];
  // Hand counter
  handCount: number;
}

// Waitlist
export interface WaitlistEntry {
  playerId: string;
  address: string;
  name: string;
  requestedAt: number;
  notifyOnSeat: boolean;
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
  // Timing
  turnStartedAt: number;
  // Track who posted blinds
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
  rankValue: number;
  name: string;
  cards: Card[];
  score: number;
}

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

// ============================================================
// Socket event data types
// ============================================================

export interface CreateTableData {
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
}

export interface JoinTableData {
  tableId: string;
  buyIn: number;
  seatIndex: number;
  address: string;
  name: string;
  escrowSessionId?: string;
}

export interface PlayerActionData {
  tableId: string;
  action: ActionType;
  amount?: number;
}

// ============================================================
// Chat / Live Log types
// ============================================================

export type ChatMessageType = "player" | "system" | "notification" | "dealer";

export interface ChatMessage {
  id: string;
  tableId: string;
  type: ChatMessageType;
  senderId?: string; // undefined for system/dealer messages
  senderName?: string;
  content: string;
  timestamp: number;
}

export interface SendChatData {
  tableId: string;
  content: string;
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
  | "registering" // accepting registrations
  | "pending" // registrations closed, about to start
  | "running" // tournament in progress
  | "paused" // host paused the tournament
  | "final_table" // down to one table
  | "completed" // tournament finished
  | "cancelled"; // tournament cancelled

export type TournamentParticipantStatus =
  | "registered" // waiting for tournament to start
  | "pending" // requested participation, awaiting approval
  | "approved" // approved but tournament not started yet
  | "playing" // actively playing
  | "eliminated" // lost all chips
  | "reentry_requested" // requested re-entry
  | "withdrawn"; // voluntarily left

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
  breakAfterLevels: number; // break every N levels
  breakDurationMinutes: number;
  // Table settings
  maxPlayersPerTable: number;
  minPlayersPerTable: number; // trigger table balancing below this
  // Registration settings
  lateRegistrationLevels: number; // allow late reg up to level N
  allowReentry: boolean;
  maxReentries: number;
  reentryDeadlineLevel: number;
  // Prize structure
  payoutPercentages: number[]; // e.g., [50, 30, 20] for top 3
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
  tableId?: string; // current table assignment
  seatIndex?: number;
  stack: number;
  reentryCount: number;
  finishPosition?: number;
  prizeAmount?: number;
  registeredAt: number;
  eliminatedAt?: number;
  // Stats within tournament
  handsPlayed: number;
  handsWon: number;
  biggestPot: number;
}

export interface Tournament {
  id: string;
  name: string;
  hostId: string; // user id of the host
  hostAddress: string; // wallet address of the host
  status: TournamentStatus;
  structure: TournamentStructure;
  // Participants
  participants: TournamentParticipant[];
  maxParticipants: number;
  // Tables
  tableIds: string[]; // active table IDs in this tournament
  // Blind level tracking
  currentBlindLevel: number;
  blindLevelStartedAt: number;
  nextBlindLevelAt: number;
  // Break tracking
  isOnBreak: boolean;
  breakEndsAt?: number;
  // Timing
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  pausedAt?: number;
  totalPausedMs: number;
  // Prize pool
  totalPrizePool: number;
  // Invite link token (for sharing)
  inviteToken: string;
  // Results
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

export interface CreateTournamentData {
  name: string;
  structure: TournamentStructure;
  maxParticipants: number;
}

export interface TournamentRegistrationData {
  tournamentId: string;
  address: string;
  name: string;
}

export interface TournamentActionData {
  tournamentId: string;
  action: "start" | "pause" | "resume" | "cancel";
}

export interface TournamentApprovalData {
  tournamentId: string;
  participantId: string;
  action: "approve" | "reject";
  customStack?: number; // optional override of default starting stack
}

// ============================================================
// Available actions for a player (sent to client)
// ============================================================

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
// Sanitized types (safe to send to clients)
// ============================================================

export interface SanitizedPlayer {
  id: string;
  address: string;
  name: string;
  stack: number;
  holeCards: Card[] | null; // null for other players, actual cards for self
  bet: number;
  status: PlayerStatus;
  seatIndex: number;
  isConnected: boolean;
  avatarUrl?: string;
}

export interface SanitizedTable {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  players: (SanitizedPlayer | null)[];
  currentHand: Hand | null;
  createdBy?: string;
  creatorAddress?: string;
  mode: TableMode;
  tournamentId?: string;
  tableNumber?: number;
  waitlistCount: number;
  handCount: number;
}

// ============================================================
// Server → Client event payloads
// ============================================================

export interface TableStatePayload {
  table: SanitizedTable;
}

export interface HandStartedPayload {
  hand: Hand;
  yourCards?: Card[];
}

export interface HandEndedPayload {
  result: HandResult;
}

export interface PlayerJoinedPayload {
  player: SanitizedPlayer;
  seatIndex: number;
}

export interface PlayerLeftPayload {
  playerId: string;
  seatIndex: number;
}

export interface PlayerActedPayload {
  playerId: string;
  action: Action;
}

export interface TurnChangedPayload {
  playerId: string;
  timeRemaining: number;
}

export interface ChatMessagePayload {
  message: ChatMessage;
}

export interface LogEntryPayload {
  entry: LogEntry;
}

export interface TournamentUpdatePayload {
  tournament: Tournament;
}

export interface TournamentTableAssignmentPayload {
  tournamentId: string;
  tableId: string;
  seatIndex: number;
}

export interface WaitlistUpdatePayload {
  tableId: string;
  waitlistCount: number;
  position?: number; // your position in waitlist, if applicable
}

export interface ErrorPayload {
  code: string;
  message: string;
}
