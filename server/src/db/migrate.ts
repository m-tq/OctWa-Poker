import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/poker.db');
const MIGRATIONS_PATH = path.join(__dirname, '../../drizzle');

// Ensure directories exist
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Running migrations...');
console.log('Database path:', DB_PATH);
console.log('Migrations path:', MIGRATIONS_PATH);

const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

try {
  migrate(db, { migrationsFolder: MIGRATIONS_PATH });
  console.log('Migrations completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
