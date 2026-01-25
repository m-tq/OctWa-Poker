/**
 * Security utilities for poker server
 * Prevents cheating and manipulation
 */

import crypto from 'crypto';

/**
 * Cryptographically secure random number generator
 * Used for deck shuffling to prevent prediction
 */
export function secureRandom(): number {
  const buffer = crypto.randomBytes(4);
  return buffer.readUInt32BE(0) / 0xFFFFFFFF;
}

/**
 * Cryptographically secure shuffle using Fisher-Yates
 * @param array Array to shuffle
 * @returns Shuffled array (mutates original)
 */
export function secureShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    // Use crypto.randomBytes for secure randomness
    const randomBuffer = crypto.randomBytes(4);
    const randomValue = randomBuffer.readUInt32BE(0);
    const j = randomValue % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash sensitive data (e.g., for logging without exposing)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Validate that amount is a safe integer within bounds
 */
export function isSafeAmount(amount: number, min: number, max: number): boolean {
  return (
    Number.isFinite(amount) &&
    Number.isInteger(amount) &&
    amount >= min &&
    amount <= max &&
    amount === Math.floor(amount) // Prevent floating point tricks
  );
}

/**
 * Sanitize player name to prevent XSS and injection
 */
export function sanitizePlayerName(name: string): string {
  return name
    .replace(/[<>\"\'&]/g, '') // Remove HTML special chars
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .trim()
    .slice(0, 30);
}

/**
 * Rate limit tracker with exponential backoff
 */
export class ExponentialBackoffLimiter {
  private violations: Map<string, { count: number; backoffUntil: number }> = new Map();
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(baseBackoffMs = 1000, maxBackoffMs = 60000) {
    this.baseBackoffMs = baseBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
  }

  /**
   * Record a violation and check if client should be blocked
   */
  recordViolation(clientId: string): { blocked: boolean; backoffMs: number } {
    const now = Date.now();
    const entry = this.violations.get(clientId);

    if (!entry) {
      this.violations.set(clientId, { count: 1, backoffUntil: now + this.baseBackoffMs });
      return { blocked: false, backoffMs: 0 };
    }

    // If still in backoff period
    if (now < entry.backoffUntil) {
      return { blocked: true, backoffMs: entry.backoffUntil - now };
    }

    // Increment violation count and calculate new backoff
    entry.count++;
    const backoffMs = Math.min(
      this.baseBackoffMs * Math.pow(2, entry.count - 1),
      this.maxBackoffMs
    );
    entry.backoffUntil = now + backoffMs;

    // Block after 5 violations
    return { blocked: entry.count >= 5, backoffMs };
  }

  /**
   * Check if client is currently blocked
   */
  isBlocked(clientId: string): boolean {
    const entry = this.violations.get(clientId);
    if (!entry) return false;
    return Date.now() < entry.backoffUntil && entry.count >= 5;
  }

  /**
   * Clear violations for a client (e.g., after successful action)
   */
  clearViolations(clientId: string): void {
    this.violations.delete(clientId);
  }
}

/**
 * Action sequence validator - ensures actions happen in valid order
 */
export class ActionSequenceValidator {
  private lastActionTime: Map<string, number> = new Map();
  private readonly minActionIntervalMs: number;

  constructor(minActionIntervalMs = 100) {
    this.minActionIntervalMs = minActionIntervalMs;
  }

  /**
   * Validate that action is not too fast (bot detection)
   */
  validateTiming(playerId: string): boolean {
    const now = Date.now();
    const lastTime = this.lastActionTime.get(playerId);

    if (lastTime && now - lastTime < this.minActionIntervalMs) {
      return false; // Too fast, possible bot
    }

    this.lastActionTime.set(playerId, now);
    return true;
  }

  /**
   * Clear timing for a player
   */
  clear(playerId: string): void {
    this.lastActionTime.delete(playerId);
  }
}
