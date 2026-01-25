import 'dotenv/config';

// ===========================================
// Environment Variable Validation
// ===========================================

function warnIfMissing(name: string, defaultValue?: string | number): void {
  if (!process.env[name]) {
    if (defaultValue !== undefined) {
      console.warn(`[CONFIG] WARNING: ${name} not set, using default: ${defaultValue}`);
    } else {
      console.error(`[CONFIG] ERROR: ${name} is required but not set!`);
    }
  }
}

function getEnvString(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value) {
    warnIfMissing(name, defaultValue);
    return defaultValue || '';
  }
  return value;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    warnIfMissing(name, defaultValue);
    return defaultValue;
  }
  const num = Number(value);
  if (isNaN(num)) {
    console.warn(`[CONFIG] WARNING: ${name} is not a valid number, using default: ${defaultValue}`);
    return defaultValue;
  }
  return num;
}

function getRequiredEnvString(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[CONFIG] FATAL: ${name} is required but not set!`);
    return '';
  }
  return value;
}

// ===========================================
// Server Configuration
// ===========================================
export const PORT = getEnvNumber('PORT', 3002);

// ===========================================
// Game Configuration - Default Table Settings
// ===========================================
export const DEFAULT_SMALL_BLIND = getEnvNumber('DEFAULT_SMALL_BLIND', 10);
export const DEFAULT_BIG_BLIND = getEnvNumber('DEFAULT_BIG_BLIND', 20);
export const DEFAULT_MIN_BUY_IN = getEnvNumber('DEFAULT_MIN_BUY_IN', 400);
export const DEFAULT_MAX_BUY_IN = getEnvNumber('DEFAULT_MAX_BUY_IN', 2000);
export const DEFAULT_MAX_PLAYERS = getEnvNumber('DEFAULT_MAX_PLAYERS', 8);

// ===========================================
// Timing Configuration
// ===========================================
export const TURN_TIMEOUT_MS = getEnvNumber('TURN_TIMEOUT_MS', 30000);
export const DISCONNECT_GRACE_MS = getEnvNumber('DISCONNECT_GRACE_MS', 60000);

// ===========================================
// Security - IP Rate Limiting
// ===========================================
export const MAX_REQUESTS_PER_IP_PER_SECOND = getEnvNumber('MAX_REQUESTS_PER_IP_PER_SECOND', 50);
export const MAX_CONNECTIONS_PER_IP = getEnvNumber('MAX_CONNECTIONS_PER_IP', 5);
export const IP_BLOCK_DURATION_MS = getEnvNumber('IP_BLOCK_DURATION_MS', 60000);

// ===========================================
// Game Wallet Configuration
// ===========================================
export const GAME_WALLET_MASTER_PASSWORD = getRequiredEnvString('GAME_WALLET_MASTER_PASSWORD');

// ===========================================
// Octra Chain Configuration
// ===========================================
export const OCTRA_RPC_URL = getEnvString('OCTRA_RPC_URL', 'https://rpc.octra.network');

// Epoch-based verification settings
export const EPOCH_POLL_INTERVAL_MS = getEnvNumber('EPOCH_POLL_INTERVAL_MS', 5000);
export const MAX_EPOCH_CHANGES = getEnvNumber('MAX_EPOCH_CHANGES', 10);

// Transaction gas (OU) settings
export const DEFAULT_OU = getEnvString('DEFAULT_OU', '1000');
export const FALLBACK_OU = getEnvString('FALLBACK_OU', '10000');

// ===========================================
// Startup Validation
// ===========================================
export function validateConfig(): boolean {
  let isValid = true;

  // Critical: Game Wallet Master Password
  if (!GAME_WALLET_MASTER_PASSWORD) {
    console.error('[CONFIG] FATAL: GAME_WALLET_MASTER_PASSWORD is required!');
    console.error('[CONFIG]   Generate with: openssl rand -base64 32');
    isValid = false;
  } else if (process.env.NODE_ENV === 'production' && GAME_WALLET_MASTER_PASSWORD.length < 32) {
    console.error('[CONFIG] FATAL: GAME_WALLET_MASTER_PASSWORD must be at least 32 characters in production!');
    isValid = false;
  }

  // Critical: Octra RPC URL
  if (!OCTRA_RPC_URL) {
    console.error('[CONFIG] FATAL: OCTRA_RPC_URL is required!');
    isValid = false;
  }

  if (isValid) {
    console.log('[CONFIG] Configuration validated successfully');
    console.log(`[CONFIG]   Port: ${PORT}`);
    console.log(`[CONFIG]   Octra RPC: ${OCTRA_RPC_URL}`);
    console.log(`[CONFIG]   Game Wallet: ${GAME_WALLET_MASTER_PASSWORD ? 'Configured' : 'NOT SET'}`);
  }

  return isValid;
}

// Run validation on import
validateConfig();
