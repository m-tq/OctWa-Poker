// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3002';
export const OCTRA_EXPLORER = import.meta.env.VITE_OCTRA_EXPLORER || 'https://octrascan.io';

// Poker Circle for OctWa SDK
export const POKER_CIRCLE = 'poker_game';

// SDK Methods required for poker
export const POKER_METHODS = ['get_balance', 'send_transaction'] as const;

// Game Configuration - Fallback defaults (actual values fetched from server)
export const DEFAULT_BLINDS = {
  small: 0.1,
  big: 0.2,
};

export const DEFAULT_BUY_IN = {
  min: 2,
  max: 4,
};

export const MAX_PLAYERS = 4;

export const TURN_TIMEOUT_SECONDS = 30;

export const RECONNECT_GRACE_PERIOD_SECONDS = 60;
