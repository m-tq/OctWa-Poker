import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/poker.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Initializing database at:', DB_PATH);

const sqlite = new Database(DB_PATH);

// Enable WAL mode
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables
sqlite.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen INTEGER NOT NULL DEFAULT (unixepoch()),
    hands_played INTEGER NOT NULL DEFAULT 0,
    hands_won INTEGER NOT NULL DEFAULT 0,
    total_winnings REAL NOT NULL DEFAULT 0,
    total_losses REAL NOT NULL DEFAULT 0
  );

  -- Tables table
  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    small_blind REAL NOT NULL,
    big_blind REAL NOT NULL,
    min_buy_in REAL NOT NULL,
    max_buy_in REAL NOT NULL,
    max_players INTEGER NOT NULL DEFAULT 8,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    created_by TEXT REFERENCES users(id)
  );

  -- Table sessions
  CREATE TABLE IF NOT EXISTS table_sessions (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    seat_index INTEGER NOT NULL,
    buy_in REAL NOT NULL,
    current_stack REAL NOT NULL,
    joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
    left_at INTEGER,
    cash_out REAL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  -- Hands table
  CREATE TABLE IF NOT EXISTS hands (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables(id),
    hand_number INTEGER NOT NULL,
    dealer_seat INTEGER NOT NULL,
    small_blind_seat INTEGER NOT NULL,
    big_blind_seat INTEGER NOT NULL,
    community_cards TEXT NOT NULL DEFAULT '[]',
    pot REAL NOT NULL DEFAULT 0,
    rake REAL NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    ended_at INTEGER,
    winners_json TEXT
  );

  -- Hand players
  CREATE TABLE IF NOT EXISTS hand_players (
    id TEXT PRIMARY KEY,
    hand_id TEXT NOT NULL REFERENCES hands(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    seat_index INTEGER NOT NULL,
    hole_cards TEXT,
    starting_stack REAL NOT NULL,
    ending_stack REAL NOT NULL,
    total_bet REAL NOT NULL DEFAULT 0,
    won REAL NOT NULL DEFAULT 0,
    final_hand TEXT,
    result TEXT NOT NULL
  );

  -- Actions
  CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    hand_id TEXT NOT NULL REFERENCES hands(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    stage TEXT NOT NULL,
    action_type TEXT NOT NULL,
    amount REAL,
    pot_after REAL NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    sequence_num INTEGER NOT NULL
  );

  -- Transactions
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    table_id TEXT REFERENCES tables(id),
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    confirmed_at INTEGER
  );

  -- Game Wallet Sessions
  CREATE TABLE IF NOT EXISTS game_wallet_sessions (
    id TEXT PRIMARY KEY,
    player_address TEXT NOT NULL,
    player_name TEXT NOT NULL,
    table_id TEXT NOT NULL,
    seat_index INTEGER NOT NULL,
    buy_in_amount REAL NOT NULL,
    current_stack REAL NOT NULL DEFAULT 0,
    game_wallet_address TEXT NOT NULL,
    deposit_tx_hash TEXT,
    deposit_confirmed_at INTEGER,
    final_stack REAL,
    settlement_tx_hash TEXT,
    settled_at INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    message_payload_json TEXT NOT NULL
  );

  -- Game Wallet Keys (encrypted)
  CREATE TABLE IF NOT EXISTS game_wallet_keys (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES game_wallet_sessions(id),
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Claimable Winnings
  CREATE TABLE IF NOT EXISTS claimable_winnings (
    id TEXT PRIMARY KEY,
    winner_session_id TEXT NOT NULL REFERENCES game_wallet_sessions(id),
    loser_session_id TEXT NOT NULL REFERENCES game_wallet_sessions(id),
    loser_address TEXT NOT NULL,
    amount REAL NOT NULL,
    claimed INTEGER NOT NULL DEFAULT 0,
    claim_tx_hash TEXT,
    claimed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Used Transaction Hashes (replay protection)
  CREATE TABLE IF NOT EXISTS used_tx_hashes (
    id TEXT PRIMARY KEY,
    tx_hash TEXT NOT NULL UNIQUE,
    session_id TEXT,
    tx_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
  CREATE INDEX IF NOT EXISTS idx_tables_active ON tables(is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_table ON table_sessions(table_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON table_sessions(user_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_hands_table ON hands(table_id);
  CREATE INDEX IF NOT EXISTS idx_hand_players_hand ON hand_players(hand_id);
  CREATE INDEX IF NOT EXISTS idx_hand_players_user ON hand_players(user_id);
  CREATE INDEX IF NOT EXISTS idx_actions_hand ON actions(hand_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_game_wallet_player ON game_wallet_sessions(player_address);
  CREATE INDEX IF NOT EXISTS idx_game_wallet_table ON game_wallet_sessions(table_id);
  CREATE INDEX IF NOT EXISTS idx_game_wallet_status ON game_wallet_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_claimable_winner ON claimable_winnings(winner_session_id);
  CREATE INDEX IF NOT EXISTS idx_claimable_loser ON claimable_winnings(loser_session_id);
  CREATE INDEX IF NOT EXISTS idx_used_tx_hash ON used_tx_hashes(tx_hash);
`);

console.log('Database initialized successfully!');
sqlite.close();
