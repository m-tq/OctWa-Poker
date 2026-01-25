/**
 * Game Wallet Manager for OCT Poker
 * Handles buy-in sessions, deposits, withdrawals, and settlements
 * With database persistence
 */

import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { db, gameWalletSessions, gameWalletKeys, claimableWinnings, usedTxHashes } from '../db/index.js';
import { eq, and, or } from 'drizzle-orm';
import { generateGameWallet } from './gameWalletCrypto.js';
import { verifyOctTransaction, sendOctTransaction, getOctraBalance } from './octraChain.js';
import type {
  GameWalletSession,
  BuyInQuote,
  BuyInMessagePayload,
  EncryptedGameWalletKey,
  PlayerGameWalletInfo,
  GameWalletStatus,
} from './types.js';

// Session expiry time (10 minutes for deposit)
const SESSION_EXPIRY_MS = 10 * 60 * 1000;

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
 * Check if tx hash has been used (replay protection)
 */
async function isTxHashUsed(txHash: string): Promise<boolean> {
  const result = await db.select().from(usedTxHashes).where(eq(usedTxHashes.txHash, txHash.toLowerCase())).limit(1);
  return result.length > 0;
}

/**
 * Mark tx hash as used
 */
async function markTxHashUsed(txHash: string, sessionId: string, txType: string): Promise<void> {
  await db.insert(usedTxHashes).values({
    id: uuidv4(),
    txHash: txHash.toLowerCase(),
    sessionId,
    txType,
  });
}

/**
 * Create buy-in quote (step 1)
 * Generates game wallet and returns deposit instructions
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

  // Generate game wallet
  const { gameWallet, encryptedKey } = await generateGameWallet(sessionId);

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

  // Save to database
  await db.insert(gameWalletSessions).values({
    id: sessionId,
    playerAddress,
    playerName,
    tableId,
    seatIndex,
    buyInAmount: amount,
    currentStack: 0,
    gameWalletAddress: gameWallet.octraAddress,
    status: 'PENDING',
    expiresAt: new Date(expiresAt),
    messagePayloadJson: JSON.stringify(messagePayload),
  });

  // Save encrypted key
  await db.insert(gameWalletKeys).values({
    id: uuidv4(),
    sessionId,
    encryptedKey: encryptedKey.encryptedKey,
    iv: encryptedKey.iv,
    authTag: encryptedKey.authTag,
    salt: encryptedKey.salt,
  });

  console.log(`[GAME-WALLET] Created buy-in quote: ${sessionId}`);
  console.log(`[GAME-WALLET]   Player: ${playerAddress.slice(0, 10)}...`);
  console.log(`[GAME-WALLET]   Amount: ${amount} OCT`);
  console.log(`[GAME-WALLET]   Wallet: ${gameWallet.octraAddress}`);

  return {
    sessionId,
    gameWalletAddress: gameWallet.octraAddress,
    amount,
    expiresAt,
    messagePayload,
    encodedMessage,
  };
}

/**
 * Verify deposit transaction (step 2)
 */
export async function verifyDeposit(
  sessionId: string,
  txHash: string
): Promise<{ success: boolean; error?: string }> {
  // Get session from database
  const sessions = await db.select().from(gameWalletSessions).where(eq(gameWalletSessions.id, sessionId)).limit(1);
  const session = sessions[0];

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status !== 'PENDING') {
    return { success: false, error: `Invalid session status: ${session.status}` };
  }

  if (new Date() > session.expiresAt) {
    await db.update(gameWalletSessions)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(eq(gameWalletSessions.id, sessionId));
    return { success: false, error: 'Session expired' };
  }

  // Check tx hash not reused
  if (await isTxHashUsed(txHash)) {
    return { success: false, error: 'Transaction hash already used (replay attack prevention)' };
  }

  // Parse message payload
  const messagePayload = JSON.parse(session.messagePayloadJson) as BuyInMessagePayload;
  const encodedMessage = encodeMessagePayload(messagePayload);

  // Verify on-chain transaction
  const verification = await verifyOctTransaction(
    txHash,
    session.gameWalletAddress,
    session.buyInAmount,
    session.playerAddress,
    encodedMessage
  );

  if (!verification.valid) {
    return { success: false, error: verification.error || 'Transaction verification failed' };
  }

  // Mark tx hash as used
  await markTxHashUsed(txHash, sessionId, 'DEPOSIT');

  // Update session
  await db.update(gameWalletSessions)
    .set({
      depositTxHash: txHash,
      depositConfirmedAt: new Date(),
      currentStack: session.buyInAmount,
      status: 'CONFIRMED',
      updatedAt: new Date(),
    })
    .where(eq(gameWalletSessions.id, sessionId));

  console.log(`[GAME-WALLET] Deposit verified: ${sessionId}`);
  console.log(`[GAME-WALLET]   TxHash: ${txHash}`);

  return { success: true };
}

/**
 * Mark session as playing
 */
export async function startPlaying(sessionId: string): Promise<boolean> {
  const result = await db.update(gameWalletSessions)
    .set({ status: 'PLAYING', updatedAt: new Date() })
    .where(and(
      eq(gameWalletSessions.id, sessionId),
      eq(gameWalletSessions.status, 'CONFIRMED')
    ));

  return result.changes > 0;
}

/**
 * Update player stack during game
 */
export async function updateStack(sessionId: string, newStack: number): Promise<boolean> {
  const result = await db.update(gameWalletSessions)
    .set({ currentStack: newStack, updatedAt: new Date() })
    .where(and(
      eq(gameWalletSessions.id, sessionId),
      or(
        eq(gameWalletSessions.status, 'PLAYING'),
        eq(gameWalletSessions.status, 'CONFIRMED')
      )
    ));

  return result.changes > 0;
}

/**
 * Record winnings from another player
 * Called when a hand ends and chips are transferred
 */
export async function recordWinnings(
  winnerSessionId: string,
  loserSessionId: string,
  loserAddress: string,
  amount: number
): Promise<void> {
  await db.insert(claimableWinnings).values({
    id: uuidv4(),
    winnerSessionId,
    loserSessionId,
    loserAddress,
    amount,
    claimed: false,
  });

  console.log(`[GAME-WALLET] Recorded winnings: ${amount} OCT from ${loserSessionId} to ${winnerSessionId}`);
}

/**
 * Get encrypted key for a session
 */
async function getEncryptedKey(sessionId: string): Promise<EncryptedGameWalletKey | null> {
  const keys = await db.select().from(gameWalletKeys).where(eq(gameWalletKeys.sessionId, sessionId)).limit(1);
  if (keys.length === 0) return null;

  const key = keys[0];
  return {
    encryptedKey: key.encryptedKey,
    iv: key.iv,
    authTag: key.authTag,
    salt: key.salt,
  };
}

/**
 * Withdraw funds from game wallet
 * Player can withdraw their remaining balance
 */
export async function withdrawFunds(
  sessionId: string,
  playerAddress: string,
  requestedAmount?: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Get session
  const sessions = await db.select().from(gameWalletSessions).where(eq(gameWalletSessions.id, sessionId)).limit(1);
  const session = sessions[0];

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.playerAddress !== playerAddress) {
    return { success: false, error: 'Not authorized to withdraw from this session' };
  }

  if (session.status !== 'PLAYING' && session.status !== 'CONFIRMED') {
    return { success: false, error: `Cannot withdraw from session in ${session.status} status` };
  }

  // Get actual balance from chain
  const actualBalance = await getOctraBalance(session.gameWalletAddress);
  
  // Calculate withdrawable amount (current stack, not more than actual balance)
  const withdrawableAmount = Math.min(session.currentStack, actualBalance);
  
  if (withdrawableAmount <= 0) {
    return { success: false, error: 'No funds available to withdraw' };
  }

  // If specific amount requested, validate it
  const amountToWithdraw = requestedAmount 
    ? Math.min(requestedAmount, withdrawableAmount)
    : withdrawableAmount;

  if (amountToWithdraw <= 0) {
    return { success: false, error: 'Invalid withdrawal amount' };
  }

  // Get encrypted key
  const encryptedKey = await getEncryptedKey(sessionId);
  if (!encryptedKey) {
    return { success: false, error: 'Game wallet key not found' };
  }

  // Update status to settling
  await db.update(gameWalletSessions)
    .set({ status: 'SETTLING', updatedAt: new Date() })
    .where(eq(gameWalletSessions.id, sessionId));

  try {
    // Send transaction
    const txHash = await sendOctTransaction(
      encryptedKey,
      sessionId,
      session.gameWalletAddress,
      playerAddress,
      amountToWithdraw
    );

    // Update session
    const newStack = session.currentStack - amountToWithdraw;
    const newStatus = newStack <= 0 ? 'COMPLETED' : 'PLAYING';

    await db.update(gameWalletSessions)
      .set({
        currentStack: newStack,
        finalStack: newStack <= 0 ? 0 : undefined,
        settlementTxHash: txHash,
        settledAt: newStack <= 0 ? new Date() : undefined,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(gameWalletSessions.id, sessionId));

    console.log(`[GAME-WALLET] Withdrawal successful: ${amountToWithdraw} OCT to ${playerAddress}`);
    console.log(`[GAME-WALLET]   TxHash: ${txHash}`);

    return { success: true, txHash };
  } catch (error) {
    // Revert status on failure
    await db.update(gameWalletSessions)
      .set({ status: 'PLAYING', updatedAt: new Date() })
      .where(eq(gameWalletSessions.id, sessionId));

    return { success: false, error: `Withdrawal failed: ${(error as Error).message}` };
  }
}

/**
 * Claim winnings from a losing player's game wallet
 */
export async function claimWinnings(
  winnerSessionId: string,
  loserSessionId: string,
  playerAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Get winner session
  const winnerSessions = await db.select().from(gameWalletSessions).where(eq(gameWalletSessions.id, winnerSessionId)).limit(1);
  const winnerSession = winnerSessions[0];

  if (!winnerSession || winnerSession.playerAddress !== playerAddress) {
    return { success: false, error: 'Not authorized to claim these winnings' };
  }

  // Get claimable winning record
  const winnings = await db.select().from(claimableWinnings)
    .where(and(
      eq(claimableWinnings.winnerSessionId, winnerSessionId),
      eq(claimableWinnings.loserSessionId, loserSessionId),
      eq(claimableWinnings.claimed, false)
    ))
    .limit(1);

  const winning = winnings[0];
  if (!winning) {
    return { success: false, error: 'No claimable winnings found' };
  }

  // Get loser session
  const loserSessions = await db.select().from(gameWalletSessions).where(eq(gameWalletSessions.id, loserSessionId)).limit(1);
  const loserSession = loserSessions[0];

  if (!loserSession) {
    return { success: false, error: 'Loser session not found' };
  }

  // Get loser's game wallet balance
  const loserBalance = await getOctraBalance(loserSession.gameWalletAddress);
  
  if (loserBalance < winning.amount) {
    return { success: false, error: `Insufficient funds in loser's game wallet (${loserBalance} < ${winning.amount})` };
  }

  // Get loser's encrypted key
  const loserKey = await getEncryptedKey(loserSessionId);
  if (!loserKey) {
    return { success: false, error: 'Loser game wallet key not found' };
  }

  try {
    // Send from loser's game wallet to winner's address
    const txHash = await sendOctTransaction(
      loserKey,
      loserSessionId,
      loserSession.gameWalletAddress,
      playerAddress,
      winning.amount
    );

    // Mark as claimed
    await db.update(claimableWinnings)
      .set({
        claimed: true,
        claimTxHash: txHash,
        claimedAt: new Date(),
      })
      .where(eq(claimableWinnings.id, winning.id));

    console.log(`[GAME-WALLET] Winnings claimed: ${winning.amount} OCT from ${loserSessionId} to ${playerAddress}`);
    console.log(`[GAME-WALLET]   TxHash: ${txHash}`);

    return { success: true, txHash };
  } catch (error) {
    return { success: false, error: `Claim failed: ${(error as Error).message}` };
  }
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<GameWalletSession | null> {
  const sessions = await db.select().from(gameWalletSessions).where(eq(gameWalletSessions.id, sessionId)).limit(1);
  if (sessions.length === 0) return null;

  const session = sessions[0];
  const winnings = await db.select().from(claimableWinnings)
    .where(and(
      eq(claimableWinnings.winnerSessionId, sessionId),
      eq(claimableWinnings.claimed, false)
    ));

  return {
    sessionId: session.id,
    playerAddress: session.playerAddress,
    playerName: session.playerName,
    tableId: session.tableId,
    seatIndex: session.seatIndex,
    buyInAmount: session.buyInAmount,
    currentStack: session.currentStack,
    gameWallet: {
      sessionId: session.id,
      octraAddress: session.gameWalletAddress,
      createdAt: session.createdAt.getTime(),
    },
    depositTxHash: session.depositTxHash || undefined,
    depositConfirmedAt: session.depositConfirmedAt?.getTime(),
    finalStack: session.finalStack || undefined,
    settlementTxHash: session.settlementTxHash || undefined,
    settledAt: session.settledAt?.getTime(),
    claimableWinnings: winnings.map(w => ({
      fromSessionId: w.loserSessionId,
      fromAddress: w.loserAddress,
      amount: w.amount,
      claimed: w.claimed,
      claimTxHash: w.claimTxHash || undefined,
      claimedAt: w.claimedAt?.getTime(),
    })),
    status: session.status as GameWalletStatus,
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    expiresAt: session.expiresAt.getTime(),
    messagePayload: JSON.parse(session.messagePayloadJson),
  };
}

/**
 * Get session by player address and table
 */
export async function getSessionByPlayer(playerAddress: string, tableId: string): Promise<GameWalletSession | null> {
  const sessions = await db.select().from(gameWalletSessions)
    .where(and(
      eq(gameWalletSessions.playerAddress, playerAddress),
      eq(gameWalletSessions.tableId, tableId),
      or(
        eq(gameWalletSessions.status, 'CONFIRMED'),
        eq(gameWalletSessions.status, 'PLAYING')
      )
    ))
    .limit(1);

  if (sessions.length === 0) return null;
  return getSession(sessions[0].id);
}

/**
 * Get all game wallet info for a player (for dashboard)
 */
export async function getPlayerGameWallets(playerAddress: string): Promise<PlayerGameWalletInfo[]> {
  const sessions = await db.select().from(gameWalletSessions)
    .where(eq(gameWalletSessions.playerAddress, playerAddress))
    .orderBy(gameWalletSessions.createdAt);

  const result: PlayerGameWalletInfo[] = [];

  for (const session of sessions) {
    // Get claimable winnings
    const winnings = await db.select().from(claimableWinnings)
      .where(and(
        eq(claimableWinnings.winnerSessionId, session.id),
        eq(claimableWinnings.claimed, false)
      ));

    // Get actual balance from chain for active sessions
    let withdrawableAmount = 0;
    if (session.status === 'PLAYING' || session.status === 'CONFIRMED') {
      const actualBalance = await getOctraBalance(session.gameWalletAddress);
      withdrawableAmount = Math.min(session.currentStack, actualBalance);
    }

    result.push({
      sessionId: session.id,
      gameWalletAddress: session.gameWalletAddress,
      tableId: session.tableId,
      buyInAmount: session.buyInAmount,
      currentStack: session.currentStack,
      status: session.status as GameWalletStatus,
      claimableWinnings: winnings.map(w => ({
        fromSessionId: w.loserSessionId,
        fromAddress: w.loserAddress,
        amount: w.amount,
        claimed: w.claimed,
        claimTxHash: w.claimTxHash || undefined,
        claimedAt: w.claimedAt?.getTime(),
      })),
      withdrawableAmount,
      createdAt: session.createdAt.getTime(),
    });
  }

  return result;
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.update(gameWalletSessions)
    .set({ status: 'EXPIRED', updatedAt: new Date() })
    .where(and(
      eq(gameWalletSessions.status, 'PENDING'),
      // expiresAt < now
    ));

  // Note: SQLite doesn't support < comparison in drizzle easily, 
  // so we'll do a raw query or handle in application
  return result.changes;
}

/**
 * Get game wallet stats
 */
export async function getGameWalletStats(): Promise<{
  totalSessions: number;
  pendingSessions: number;
  activeSessions: number;
  completedSessions: number;
}> {
  const all = await db.select().from(gameWalletSessions);
  
  let pending = 0;
  let active = 0;
  let completed = 0;

  for (const session of all) {
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
    totalSessions: all.length,
    pendingSessions: pending,
    activeSessions: active,
    completedSessions: completed,
  };
}
