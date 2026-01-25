/**
 * Escrow Manager for OCT Poker
 * Handles buy-in sessions, deposits, and settlements
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { generateEscrowWallet, getSigningKeypair } from './escrowCrypto.js';
import type {
  BuyInSession,
  BuyInQuote,
  BuyInMessagePayload,
  EncryptedEscrowKey,
} from './types.js';

// Session expiry time (10 minutes for deposit)
const SESSION_EXPIRY_MS = 10 * 60 * 1000;

// In-memory storage (should be persisted to database in production)
const sessions: Map<string, BuyInSession> = new Map();
const encryptedKeys: Map<string, EncryptedEscrowKey> = new Map();

// Nonce tracking for replay protection
const usedNonces: Set<string> = new Set();

/**
 * Generate unique nonce
 */
function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Encode message payload for transaction
 */
function encodeMessagePayload(payload: BuyInMessagePayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode message payload from transaction
 */
export function decodeMessagePayload(encoded: string): BuyInMessagePayload | null {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(json) as BuyInMessagePayload;
  } catch {
    return null;
  }
}

/**
 * Hash message payload for verification
 */
export function hashPayload(payload: BuyInMessagePayload): string {
  const json = JSON.stringify(payload);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Create buy-in quote (step 1)
 * Generates escrow wallet and returns deposit instructions
 */
export async function createBuyInQuote(
  playerAddress: string,
  playerName: string,
  tableId: string,
  seatIndex: number,
  amount: number
): Promise<BuyInQuote> {
  const sessionId = uuidv4();
  const nonce = generateNonce();
  const timestamp = Date.now();
  const expiresAt = timestamp + SESSION_EXPIRY_MS;

  // Generate escrow wallet
  const { escrow, encryptedKey } = await generateEscrowWallet(sessionId);

  // Create message payload
  const messagePayload: BuyInMessagePayload = {
    address: playerAddress,
    amount,
    username: playerName,
    timestamp,
    tableId,
    seatIndex,
    nonce,
  };

  // Encode message for transaction
  const encodedMessage = encodeMessagePayload(messagePayload);

  // Create session
  const session: BuyInSession = {
    sessionId,
    playerAddress,
    playerName,
    tableId,
    seatIndex,
    buyInAmount: amount,
    currentStack: 0, // Will be set after deposit confirmed
    escrow,
    status: 'PENDING',
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt,
    messagePayload,
  };

  // Store session and encrypted key
  sessions.set(sessionId, session);
  encryptedKeys.set(sessionId, encryptedKey);

  console.log(`[ESCROW] Created buy-in quote: ${sessionId}`);
  console.log(`[ESCROW]   Player: ${playerAddress.slice(0, 10)}...`);
  console.log(`[ESCROW]   Amount: ${amount} OCT`);
  console.log(`[ESCROW]   Escrow: ${escrow.octraAddress}`);

  return {
    sessionId,
    escrowAddress: escrow.octraAddress,
    amount,
    expiresAt,
    messagePayload,
    encodedMessage,
  };
}

/**
 * Verify deposit transaction (step 2)
 * Called after player sends OCT to escrow address
 */
export async function verifyDeposit(
  sessionId: string,
  txHash: string,
  verifyOnChain: (txHash: string, expectedAddress: string, expectedAmount: number, expectedMessage: string) => Promise<boolean>
): Promise<{ success: boolean; error?: string }> {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status !== 'PENDING') {
    return { success: false, error: `Invalid session status: ${session.status}` };
  }

  if (Date.now() > session.expiresAt) {
    session.status = 'EXPIRED';
    session.updatedAt = Date.now();
    return { success: false, error: 'Session expired' };
  }

  // Verify on-chain transaction
  const encodedMessage = encodeMessagePayload(session.messagePayload);
  const isValid = await verifyOnChain(
    txHash,
    session.escrow.octraAddress,
    session.buyInAmount,
    encodedMessage
  );

  if (!isValid) {
    return { success: false, error: 'Transaction verification failed' };
  }

  // Check nonce hasn't been used (replay protection)
  if (usedNonces.has(session.messagePayload.nonce)) {
    return { success: false, error: 'Nonce already used (replay attack)' };
  }
  usedNonces.add(session.messagePayload.nonce);

  // Update session
  session.depositTxHash = txHash;
  session.depositConfirmedAt = Date.now();
  session.currentStack = session.buyInAmount;
  session.status = 'CONFIRMED';
  session.updatedAt = Date.now();

  console.log(`[ESCROW] Deposit verified: ${sessionId}`);
  console.log(`[ESCROW]   TxHash: ${txHash}`);

  return { success: true };
}

/**
 * Mark session as playing
 */
export function startPlaying(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'CONFIRMED') {
    return false;
  }

  session.status = 'PLAYING';
  session.updatedAt = Date.now();
  return true;
}

/**
 * Update player stack during game
 */
export function updateStack(sessionId: string, newStack: number): boolean {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'PLAYING') {
    return false;
  }

  session.currentStack = newStack;
  session.updatedAt = Date.now();
  return true;
}

/**
 * Settle session (cash out or game end)
 * Sends remaining funds back to player
 */
export async function settleSession(
  sessionId: string,
  finalStack: number,
  sendTransaction: (
    fromKeypair: { secretKey: Uint8Array },
    toAddress: string,
    amount: number
  ) => Promise<string>
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const session = sessions.get(sessionId);
  const encryptedKey = encryptedKeys.get(sessionId);

  if (!session || !encryptedKey) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status !== 'PLAYING' && session.status !== 'CONFIRMED') {
    return { success: false, error: `Invalid session status: ${session.status}` };
  }

  session.status = 'SETTLING';
  session.finalStack = finalStack;
  session.updatedAt = Date.now();

  // If player has chips to cash out
  if (finalStack > 0) {
    try {
      // Get signing keypair
      const keypair = getSigningKeypair(encryptedKey, sessionId);

      // Send funds to player
      const txHash = await sendTransaction(
        { secretKey: keypair.secretKey },
        session.playerAddress,
        finalStack
      );

      session.settlementTxHash = txHash;
      session.settledAt = Date.now();
      session.status = 'COMPLETED';
      session.updatedAt = Date.now();

      // Clear sensitive data
      keypair.privateKey.fill(0);
      keypair.secretKey.fill(0);

      console.log(`[ESCROW] Session settled: ${sessionId}`);
      console.log(`[ESCROW]   Final stack: ${finalStack} OCT`);
      console.log(`[ESCROW]   TxHash: ${txHash}`);

      return { success: true, txHash };
    } catch (error) {
      session.status = 'PLAYING'; // Revert status
      session.updatedAt = Date.now();
      return { success: false, error: `Settlement failed: ${(error as Error).message}` };
    }
  } else {
    // Player busted, no funds to return
    session.settledAt = Date.now();
    session.status = 'COMPLETED';
    session.updatedAt = Date.now();

    console.log(`[ESCROW] Session completed (busted): ${sessionId}`);
    return { success: true };
  }
}

/**
 * Refund session (e.g., table closed before game started)
 */
export async function refundSession(
  sessionId: string,
  sendTransaction: (
    fromKeypair: { secretKey: Uint8Array },
    toAddress: string,
    amount: number
  ) => Promise<string>
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const session = sessions.get(sessionId);
  const encryptedKey = encryptedKeys.get(sessionId);

  if (!session || !encryptedKey) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status !== 'CONFIRMED') {
    return { success: false, error: 'Can only refund confirmed sessions' };
  }

  try {
    const keypair = getSigningKeypair(encryptedKey, sessionId);

    const txHash = await sendTransaction(
      { secretKey: keypair.secretKey },
      session.playerAddress,
      session.buyInAmount
    );

    session.settlementTxHash = txHash;
    session.settledAt = Date.now();
    session.status = 'REFUNDED';
    session.updatedAt = Date.now();

    keypair.privateKey.fill(0);
    keypair.secretKey.fill(0);

    console.log(`[ESCROW] Session refunded: ${sessionId}`);
    return { success: true, txHash };
  } catch (error) {
    return { success: false, error: `Refund failed: ${(error as Error).message}` };
  }
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): BuyInSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get session by player address and table
 */
export function getSessionByPlayer(playerAddress: string, tableId: string): BuyInSession | undefined {
  for (const session of sessions.values()) {
    if (
      session.playerAddress === playerAddress &&
      session.tableId === tableId &&
      (session.status === 'CONFIRMED' || session.status === 'PLAYING')
    ) {
      return session;
    }
  }
  return undefined;
}

/**
 * Cleanup expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of sessions) {
    if (session.status === 'PENDING' && now > session.expiresAt) {
      session.status = 'EXPIRED';
      session.updatedAt = now;
      // Remove encrypted key for expired sessions
      encryptedKeys.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[ESCROW] Cleaned up ${cleaned} expired sessions`);
  }

  return cleaned;
}

// Cleanup expired sessions every minute
setInterval(cleanupExpiredSessions, 60 * 1000);

/**
 * Get escrow stats
 */
export function getEscrowStats(): {
  totalSessions: number;
  pendingSessions: number;
  activeSessions: number;
  completedSessions: number;
} {
  let pending = 0;
  let active = 0;
  let completed = 0;

  for (const session of sessions.values()) {
    switch (session.status) {
      case 'PENDING':
        pending++;
        break;
      case 'CONFIRMED':
      case 'PLAYING':
        active++;
        break;
      case 'COMPLETED':
      case 'REFUNDED':
        completed++;
        break;
    }
  }

  return {
    totalSessions: sessions.size,
    pendingSessions: pending,
    activeSessions: active,
    completedSessions: completed,
  };
}
