import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Users table - stores wallet addresses and stats
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  address: text('address').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastSeen: integer('last_seen', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // Stats
  handsPlayed: integer('hands_played').notNull().default(0),
  handsWon: integer('hands_won').notNull().default(0),
  totalWinnings: real('total_winnings').notNull().default(0),
  totalLosses: real('total_losses').notNull().default(0),
});

// Tables table - poker tables configuration
export const tables = sqliteTable('tables', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  smallBlind: real('small_blind').notNull(),
  bigBlind: real('big_blind').notNull(),
  minBuyIn: real('min_buy_in').notNull(),
  maxBuyIn: real('max_buy_in').notNull(),
  maxPlayers: integer('max_players').notNull().default(8),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdBy: text('created_by').references(() => users.id),
});

// Table sessions - tracks players at tables
export const tableSessions = sqliteTable('table_sessions', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull().references(() => tables.id),
  userId: text('user_id').notNull().references(() => users.id),
  seatIndex: integer('seat_index').notNull(),
  buyIn: real('buy_in').notNull(),
  currentStack: real('current_stack').notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  leftAt: integer('left_at', { mode: 'timestamp' }),
  cashOut: real('cash_out'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// Hands table - completed hands history
export const hands = sqliteTable('hands', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull().references(() => tables.id),
  handNumber: integer('hand_number').notNull(),
  dealerSeat: integer('dealer_seat').notNull(),
  smallBlindSeat: integer('small_blind_seat').notNull(),
  bigBlindSeat: integer('big_blind_seat').notNull(),
  communityCards: text('community_cards').notNull(), // JSON array
  pot: real('pot').notNull(),
  rake: real('rake').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  winnersJson: text('winners_json'), // JSON array of winner info
});

// Hand players - players in each hand
export const handPlayers = sqliteTable('hand_players', {
  id: text('id').primaryKey(),
  handId: text('hand_id').notNull().references(() => hands.id),
  userId: text('user_id').notNull().references(() => users.id),
  seatIndex: integer('seat_index').notNull(),
  holeCards: text('hole_cards'), // JSON array, null if mucked
  startingStack: real('starting_stack').notNull(),
  endingStack: real('ending_stack').notNull(),
  totalBet: real('total_bet').notNull().default(0),
  won: real('won').notNull().default(0),
  finalHand: text('final_hand'), // JSON hand result
  result: text('result').notNull(), // 'won', 'lost', 'folded', 'split'
});

// Actions table - all actions in hands
export const actions = sqliteTable('actions', {
  id: text('id').primaryKey(),
  handId: text('hand_id').notNull().references(() => hands.id),
  userId: text('user_id').notNull().references(() => users.id),
  stage: text('stage').notNull(), // 'preflop', 'flop', 'turn', 'river'
  actionType: text('action_type').notNull(), // 'fold', 'check', 'call', 'bet', 'raise', 'all-in'
  amount: real('amount'),
  potAfter: real('pot_after').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  sequenceNum: integer('sequence_num').notNull(),
});

// Transactions table - buy-in and cash-out records
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tableId: text('table_id').references(() => tables.id),
  type: text('type').notNull(), // 'buy_in', 'cash_out', 'add_on'
  amount: real('amount').notNull(),
  txHash: text('tx_hash'), // blockchain transaction hash
  status: text('status').notNull().default('pending'), // 'pending', 'confirmed', 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
});

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;
export type TableSession = typeof tableSessions.$inferSelect;
export type Hand = typeof hands.$inferSelect;
export type HandPlayer = typeof handPlayers.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
