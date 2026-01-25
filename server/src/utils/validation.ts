/**
 * Input validation utilities for poker server
 * Security: Validate all client inputs before processing
 */

import type { CreateTableData, JoinTableData, PlayerActionData, ActionType } from '../types/index.js';
import { isSafeAmount, sanitizePlayerName } from './security.js';

// Validation constants
const MAX_TABLE_NAME_LENGTH = 50;
const MAX_PLAYER_NAME_LENGTH = 30;
const MIN_BLIND = 0.001;
const MAX_BLIND = 1000000;
const MIN_BUY_IN = 0.01;
const MAX_BUY_IN = 100000000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const VALID_ACTIONS: ActionType[] = ['fold', 'check', 'call', 'bet', 'raise', 'all-in'];

// Sanitize string input
function sanitizeString(input: unknown, maxLength: number): string | null {
  if (typeof input !== 'string') return null;
  // Remove control characters, HTML special chars, and trim
  const sanitized = input
    .replace(/[<>\"\'&]/g, '') // Remove HTML special chars
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .trim();
  if (sanitized.length === 0 || sanitized.length > maxLength) return null;
  return sanitized;
}

// Validate positive integer with safe bounds
function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

// Validate positive number (allows decimals) with safe bounds
function isPositiveNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

// Validate non-negative number with safe bounds (allows decimals)
function isNonNegativeNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

// Validate wallet address format (strict check)
function isValidAddress(address: unknown): address is string {
  if (typeof address !== 'string') return false;
  // Strict format check - alphanumeric, 20-64 chars, no special chars
  if (!/^[a-zA-Z0-9]{20,64}$/.test(address)) return false;
  // Additional check: no repeated patterns (potential attack)
  if (/(.)\1{10,}/.test(address)) return false;
  return true;
}

// Validate UUID format (strict)
function isValidUUID(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  // Strict UUID v4 format
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

export function validateCreateTableData(data: unknown): ValidationResult<CreateTableData> {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const d = data as Record<string, unknown>;

  const name = sanitizeString(d.name, MAX_TABLE_NAME_LENGTH);
  if (!name) {
    return { valid: false, error: 'Invalid table name' };
  }

  if (!isPositiveNumber(d.smallBlind) || d.smallBlind < MIN_BLIND || d.smallBlind > MAX_BLIND) {
    return { valid: false, error: 'Invalid small blind' };
  }

  if (!isPositiveNumber(d.bigBlind) || d.bigBlind < MIN_BLIND || d.bigBlind > MAX_BLIND) {
    return { valid: false, error: 'Invalid big blind' };
  }

  if (d.bigBlind < d.smallBlind) {
    return { valid: false, error: 'Big blind must be >= small blind' };
  }

  if (!isPositiveNumber(d.minBuyIn) || d.minBuyIn < MIN_BUY_IN || d.minBuyIn > MAX_BUY_IN) {
    return { valid: false, error: 'Invalid min buy-in' };
  }

  if (!isPositiveNumber(d.maxBuyIn) || d.maxBuyIn < MIN_BUY_IN || d.maxBuyIn > MAX_BUY_IN) {
    return { valid: false, error: 'Invalid max buy-in' };
  }

  if (d.maxBuyIn < d.minBuyIn) {
    return { valid: false, error: 'Max buy-in must be >= min buy-in' };
  }

  if (!isPositiveInteger(d.maxPlayers) || d.maxPlayers < MIN_PLAYERS || d.maxPlayers > MAX_PLAYERS) {
    return { valid: false, error: `Max players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}` };
  }

  return {
    valid: true,
    data: {
      name,
      smallBlind: d.smallBlind as number,
      bigBlind: d.bigBlind as number,
      minBuyIn: d.minBuyIn as number,
      maxBuyIn: d.maxBuyIn as number,
      maxPlayers: d.maxPlayers as number,
    },
  };
}

export function validateJoinTableData(data: unknown): ValidationResult<JoinTableData> {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const d = data as Record<string, unknown>;

  if (!isValidUUID(d.tableId)) {
    return { valid: false, error: 'Invalid table ID' };
  }

  if (!isPositiveNumber(d.buyIn) || d.buyIn > MAX_BUY_IN) {
    return { valid: false, error: 'Invalid buy-in amount' };
  }

  if (!Number.isInteger(d.seatIndex) || (d.seatIndex as number) < 0 || (d.seatIndex as number) >= MAX_PLAYERS) {
    return { valid: false, error: 'Invalid seat index' };
  }

  if (!isValidAddress(d.address)) {
    return { valid: false, error: 'Invalid wallet address' };
  }

  const name = sanitizeString(d.name, MAX_PLAYER_NAME_LENGTH);
  if (!name) {
    return { valid: false, error: 'Invalid player name' };
  }

  // Optional escrow session ID (UUID format)
  let escrowSessionId: string | undefined;
  if (d.escrowSessionId !== undefined) {
    if (!isValidUUID(d.escrowSessionId)) {
      return { valid: false, error: 'Invalid escrow session ID' };
    }
    escrowSessionId = d.escrowSessionId as string;
  }

  return {
    valid: true,
    data: {
      tableId: d.tableId as string,
      buyIn: d.buyIn as number,
      seatIndex: d.seatIndex as number,
      address: d.address as string,
      name,
      escrowSessionId,
    },
  };
}

export function validatePlayerActionData(data: unknown): ValidationResult<PlayerActionData> {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const d = data as Record<string, unknown>;

  if (!isValidUUID(d.tableId)) {
    return { valid: false, error: 'Invalid table ID' };
  }

  if (typeof d.action !== 'string' || !VALID_ACTIONS.includes(d.action as ActionType)) {
    return { valid: false, error: 'Invalid action type' };
  }

  // Amount is optional but must be valid if provided
  if (d.amount !== undefined) {
    if (!isNonNegativeNumber(d.amount) || d.amount > MAX_BUY_IN) {
      return { valid: false, error: 'Invalid amount' };
    }
  }

  return {
    valid: true,
    data: {
      tableId: d.tableId as string,
      action: d.action as ActionType,
      amount: d.amount as number | undefined,
    },
  };
}

export function validateRejoinData(data: unknown): ValidationResult<{ tableId: string; address: string }> {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const d = data as Record<string, unknown>;

  if (!isValidUUID(d.tableId)) {
    return { valid: false, error: 'Invalid table ID' };
  }

  if (!isValidAddress(d.address)) {
    return { valid: false, error: 'Invalid wallet address' };
  }

  return {
    valid: true,
    data: {
      tableId: d.tableId as string,
      address: d.address as string,
    },
  };
}

export function validateLeaveTableData(data: unknown): ValidationResult<{ tableId: string }> {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const d = data as Record<string, unknown>;

  if (!isValidUUID(d.tableId)) {
    return { valid: false, error: 'Invalid table ID' };
  }

  return {
    valid: true,
    data: {
      tableId: d.tableId as string,
    },
  };
}
