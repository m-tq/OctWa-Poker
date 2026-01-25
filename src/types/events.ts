import type { Table, Hand, Player, Action, ActionType, HandResult, Card, HandStage } from './game';

// Client -> Server events
export interface ClientToServerEvents {
  'join-table': {
    tableId: string;
    buyIn: number;
    seatIndex: number;
  };
  'leave-table': {
    tableId: string;
  };
  'player-action': {
    tableId: string;
    action: ActionType;
    amount?: number;
  };
  'sit-out': {
    tableId: string;
  };
  'sit-in': {
    tableId: string;
  };
  'create-table': {
    name: string;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    maxPlayers: number;
  };
  'get-tables': void;
}

// Server -> Client events
export interface ServerToClientEvents {
  'tables-list': Table[];
  'table-created': Table;
  'table-removed': { tableId: string };
  'table-state': Table;
  'player-joined': {
    player: Player;
    seatIndex: number;
  };
  'player-left': {
    playerId: string;
    seatIndex: number;
  };
  'hand-started': {
    hand: Hand;
    yourCards?: Card[];
  };
  'community-cards': {
    cards: Card[];
    stage: HandStage;
  };
  'player-acted': {
    playerId: string;
    action: Action;
  };
  'turn-changed': {
    playerId: string;
    timeRemaining: number;
  };
  'hand-ended': {
    result: HandResult;
  };
  'stack-updated': {
    playerId: string;
    stack: number;
  };
  'error': {
    code: string;
    message: string;
  };
  'connection-status': {
    connected: boolean;
  };
}
