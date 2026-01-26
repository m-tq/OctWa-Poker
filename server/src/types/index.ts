// Card types
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'C' | 'D' | 'H' | 'S';

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Player types
export type PlayerStatus = 'active' | 'folded' | 'all-in' | 'sitting-out';

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
}

// Table types
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
}

// Hand types
export type HandStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

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
}

// Action types
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export interface Action {
  playerId: string;
  type: ActionType;
  amount?: number;
  timestamp: number;
}

// Hand evaluation types
export type HandRank =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

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

// Socket event types
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
