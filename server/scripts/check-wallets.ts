#!/usr/bin/env npx tsx
/**
 * Check Game Wallets Script
 * 
 * Lists all game wallet sessions with their on-chain balances.
 * Useful for monitoring and debugging.
 * 
 * Usage:
 *   npx tsx scripts/check-wallets.ts
 *   npx tsx scripts/check-wallets.ts --active
 *   npx tsx scripts/check-wallets.ts --with-balance
 *   npx tsx scripts/check-wallets.ts --session <sessionId>
 */

import 'dotenv/config';
import { db, gameWalletSessions, gameWalletKeys, claimableWinnings } from '../src/db/index.js';
import { eq, or, and } from 'drizzle-orm';
import { getOctraBalance } from '../src/gameWallet/octraChain.js';

/**
 * Format date
 */
function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Get session details
 */
async function getSessionDetails(sessionId: string): Promise<void> {
  const sessions = await db.select().from(gameWalletSessions)
    .where(eq(gameWalletSessions.id, sessionId))
    .limit(1);

  if (sessions.length === 0) {
    console.log('❌ Session not found');
    return;
  }

  const session = sessions[0];
  const balance = await getOctraBalance(session.gameWalletAddress);

  // Get claimable winnings
  const winnings = await db.select().from(claimableWinnings)
    .where(eq(claimableWinnings.winnerSessionId, sessionId));

  // Get key info
  const keys = await db.select().from(gameWalletKeys)
    .where(eq(gameWalletKeys.sessionId, sessionId))
    .limit(1);

  console.log('\n📋 Session Details\n');
  console.log('═'.repeat(60));
  console.log(`Session ID:      ${session.id}`);
  console.log(`Player:          ${session.playerName}`);
  console.log(`Player Address:  ${session.playerAddress}`);
  console.log(`Table ID:        ${session.tableId}`);
  console.log(`Seat Index:      ${session.seatIndex}`);
  console.log('─'.repeat(60));
  console.log(`Status:          ${session.status}`);
  console.log(`Buy-in Amount:   ${session.buyInAmount} OCT`);
  console.log(`Current Stack:   ${session.currentStack} OCT`);
  console.log(`Final Stack:     ${session.finalStack ?? 'N/A'} OCT`);
  console.log('─'.repeat(60));
  console.log(`Game Wallet:     ${session.gameWalletAddress}`);
  console.log(`Wallet Balance:  ${balance.toFixed(6)} OCT`);
  console.log(`Has Key:         ${keys.length > 0 ? '✅ Yes' : '❌ No'}`);
  console.log('─'.repeat(60));
  console.log(`Deposit TX:      ${session.depositTxHash || 'N/A'}`);
  console.log(`Settlement TX:   ${session.settlementTxHash || 'N/A'}`);
  console.log('─'.repeat(60));
  console.log(`Created:         ${formatDate(session.createdAt)}`);
  console.log(`Updated:         ${formatDate(session.updatedAt)}`);
  console.log(`Expires:         ${formatDate(session.expiresAt)}`);
  if (session.depositConfirmedAt) {
    console.log(`Deposit At:      ${formatDate(session.depositConfirmedAt)}`);
  }
  if (session.settledAt) {
    console.log(`Settled At:      ${formatDate(session.settledAt)}`);
  }
  console.log('═'.repeat(60));

  if (winnings.length > 0) {
    console.log('\n💰 Claimable Winnings:');
    for (const w of winnings) {
      console.log(`  - ${w.amount} OCT from ${w.loserAddress.slice(0, 10)}... (${w.claimed ? 'Claimed' : 'Pending'})`);
    }
  }

  console.log('\n');
}

/**
 * List all sessions
 */
async function listSessions(activeOnly: boolean, withBalanceOnly: boolean): Promise<void> {
  let query = db.select().from(gameWalletSessions).orderBy(gameWalletSessions.createdAt);

  const sessions = await query;

  if (sessions.length === 0) {
    console.log('\n📋 No game wallet sessions found.\n');
    return;
  }

  console.log('\n📋 Game Wallet Sessions\n');
  console.log('═'.repeat(120));
  console.log(
    'ID'.padEnd(10) + ' | ' +
    'Player'.padEnd(12) + ' | ' +
    'Status'.padEnd(10) + ' | ' +
    'Buy-in'.padStart(8) + ' | ' +
    'Stack'.padStart(8) + ' | ' +
    'Balance'.padStart(12) + ' | ' +
    'Wallet Address'
  );
  console.log('─'.repeat(120));

  let totalBalance = 0;
  let displayedCount = 0;

  for (const session of sessions) {
    // Filter active only
    if (activeOnly && !['PENDING', 'CONFIRMED', 'PLAYING'].includes(session.status)) {
      continue;
    }

    const balance = await getOctraBalance(session.gameWalletAddress);
    totalBalance += balance;

    // Filter with balance only
    if (withBalanceOnly && balance <= 0) {
      continue;
    }

    displayedCount++;

    const statusIcon = {
      'PENDING': '⏳',
      'CONFIRMED': '✅',
      'PLAYING': '🎮',
      'SETTLING': '💸',
      'COMPLETED': '✔️',
      'REFUNDED': '↩️',
      'EXPIRED': '⌛',
    }[session.status] || '❓';

    console.log(
      `${session.id.slice(0, 8)}..`.padEnd(10) + ' | ' +
      session.playerName.slice(0, 12).padEnd(12) + ' | ' +
      `${statusIcon} ${session.status}`.padEnd(10) + ' | ' +
      `${session.buyInAmount}`.padStart(8) + ' | ' +
      `${session.currentStack}`.padStart(8) + ' | ' +
      `${balance.toFixed(6)}`.padStart(12) + ' | ' +
      session.gameWalletAddress
    );
  }

  console.log('═'.repeat(120));
  console.log(`\nTotal: ${displayedCount} sessions | Total Balance: ${totalBalance.toFixed(6)} OCT\n`);
}

/**
 * Show stats
 */
async function showStats(): Promise<void> {
  const sessions = await db.select().from(gameWalletSessions);

  const stats = {
    total: sessions.length,
    pending: 0,
    confirmed: 0,
    playing: 0,
    settling: 0,
    completed: 0,
    refunded: 0,
    expired: 0,
  };

  let totalBuyIn = 0;
  let totalBalance = 0;

  for (const session of sessions) {
    totalBuyIn += session.buyInAmount;
    
    switch (session.status) {
      case 'PENDING': stats.pending++; break;
      case 'CONFIRMED': stats.confirmed++; break;
      case 'PLAYING': stats.playing++; break;
      case 'SETTLING': stats.settling++; break;
      case 'COMPLETED': stats.completed++; break;
      case 'REFUNDED': stats.refunded++; break;
      case 'EXPIRED': stats.expired++; break;
    }

    // Only check balance for active sessions
    if (['PENDING', 'CONFIRMED', 'PLAYING', 'SETTLING'].includes(session.status)) {
      const balance = await getOctraBalance(session.gameWalletAddress);
      totalBalance += balance;
    }
  }

  console.log('\n📊 Game Wallet Statistics\n');
  console.log('═'.repeat(40));
  console.log(`Total Sessions:    ${stats.total}`);
  console.log('─'.repeat(40));
  console.log(`⏳ Pending:        ${stats.pending}`);
  console.log(`✅ Confirmed:      ${stats.confirmed}`);
  console.log(`🎮 Playing:        ${stats.playing}`);
  console.log(`💸 Settling:       ${stats.settling}`);
  console.log(`✔️  Completed:      ${stats.completed}`);
  console.log(`↩️  Refunded:       ${stats.refunded}`);
  console.log(`⌛ Expired:        ${stats.expired}`);
  console.log('─'.repeat(40));
  console.log(`Total Buy-ins:     ${totalBuyIn.toFixed(2)} OCT`);
  console.log(`Active Balance:    ${totalBalance.toFixed(6)} OCT`);
  console.log('═'.repeat(40));
  console.log('\n');
}

/**
 * Main
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  npx tsx scripts/check-wallets.ts              List all sessions
  npx tsx scripts/check-wallets.ts --active     List only active sessions
  npx tsx scripts/check-wallets.ts --with-balance  List only sessions with balance
  npx tsx scripts/check-wallets.ts --stats      Show statistics
  npx tsx scripts/check-wallets.ts --session <id>  Show session details
`);
    process.exit(0);
  }

  if (args.includes('--stats')) {
    await showStats();
    process.exit(0);
  }

  if (args.includes('--session')) {
    const idx = args.indexOf('--session');
    const sessionId = args[idx + 1];
    if (!sessionId) {
      console.error('❌ Please provide session ID');
      process.exit(1);
    }
    await getSessionDetails(sessionId);
    process.exit(0);
  }

  const activeOnly = args.includes('--active');
  const withBalanceOnly = args.includes('--with-balance');

  await listSessions(activeOnly, withBalanceOnly);
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
