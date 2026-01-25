/**
 * Game Wallet Database Schema
 * Persistent storage for game wallet sessions
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Game wallet sessions
export const gameWalletSessions = sqliteTable('game_wallet_sessions', {
  id: text('id').primaryKey(), // Session ID (UUID)
  playerAddress: text('player_address').notNull(),
  playerName: text('player_name').notNull(),
  tableId: text('table_id').notNull(),
  seatIndex: integer('seat_index').notNull(),
  buyInAmount: real('buy_in_amount').notNull(),
  currentStack: real('current_stack').notNull().default(0),
  gameWalletAddress: text('game_wallet_address').notNull(),
  
  // Transaction info
  depositTxHash: text('deposit_tx_hash'),
  depositConfirmedAt: integer('deposit_confirmed_at', { mode: 'timestamp' }),
  
  // Settlement info
  finalStack: real('final_stack'),
  settlementTxHash: text('settlement_tx_hash'),
  settledAt: integer('settled_at', { mode: 'timestamp' }),
  
  // Status
  status: text('status').notNull().default('PENDING'), // PENDING, CONFIRMED, PLAYING, SETTLING, COMPLETED, REFUNDED, EXPIRED
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  
  // Message payload (JSON)
  messagePayloadJson: text('message_payload_json').notNull(),
});

// Encrypted game wallet keys (SECURITY CRITICAL)
export const gameWalletKeys = sqliteTable('game_wallet_keys', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => gameWalletSessions.id),
  encryptedKey: text('encrypted_key').notNull(), // AES-256-GCM encrypted
  iv: text('iv').notNull(), // Initialization vector
  authTag: text('auth_tag').notNull(), // Authentication tag
  salt: text('salt').notNull(), // Salt for key derivation
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Claimable winnings (from losing players)
export const claimableWinnings = sqliteTable('claimable_winnings', {
  id: text('id').primaryKey(),
  winnerSessionId: text('winner_session_id').notNull().references(() => gameWalletSessions.id),
  loserSessionId: text('loser_session_id').notNull().references(() => gameWalletSessions.id),
  loserAddress: text('loser_address').notNull(),
  amount: real('amount').notNull(),
  claimed: integer('claimed', { mode: 'boolean' }).notNull().default(false),
  claimTxHash: text('claim_tx_hash'),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Used transaction hashes (replay protection)
export const usedTxHashes = sqliteTable('used_tx_hashes', {
  id: text('id').primaryKey(),
  txHash: text('tx_hash').notNull().unique(),
  sessionId: text('session_id'),
  txType: text('tx_type').notNull(), // DEPOSIT, WITHDRAW, CLAIM
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Types
export type GameWalletSessionRow = typeof gameWalletSessions.$inferSelect;
export type GameWalletKeyRow = typeof gameWalletKeys.$inferSelect;
export type ClaimableWinningRow = typeof claimableWinnings.$inferSelect;
export type UsedTxHashRow = typeof usedTxHashes.$inferSelect;
