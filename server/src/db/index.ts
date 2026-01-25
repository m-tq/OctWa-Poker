import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import * as gameWalletSchema from './gameWalletSchema.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/poker.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance with all schemas
export const db = drizzle(sqlite, { schema: { ...schema, ...gameWalletSchema } });

// Export schema for use in other files
export * from './schema.js';
export * from './gameWalletSchema.js';

// Close database on process exit
process.on('exit', () => sqlite.close());
process.on('SIGINT', () => {
  sqlite.close();
  process.exit(0);
});
