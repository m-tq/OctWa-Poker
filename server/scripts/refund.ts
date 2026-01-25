#!/usr/bin/env npx tsx
/**
 * Simple Refund Script
 * 
 * Usage: npm run refund <sessionId> <toAddress>
 * 
 * Refunds all balance from game wallet to specified address using OU 1000
 */

import 'dotenv/config';
import nacl from 'tweetnacl';
import { db, gameWalletSessions, gameWalletKeys } from '../src/db/index.js';
import { eq } from 'drizzle-orm';
import { getSigningKeypair } from '../src/gameWallet/gameWalletCrypto.js';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://rpc.octra.org';
const OU = '1000';

async function getBalance(address: string): Promise<number> {
  const res = await fetch(`${OCTRA_RPC_URL}/balance/${address}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as { balance?: string | number };
  // Balance from RPC is already in OCT (might be string or number)
  const balance = data.balance ?? 0;
  return typeof balance === 'string' ? parseFloat(balance) : balance;
}

async function getNonce(address: string): Promise<number> {
  const res = await fetch(`${OCTRA_RPC_URL}/balance/${address}`);
  if (!res.ok) return 0;
  const data = await res.json() as { nonce?: number };
  return data.nonce ?? 0;
}

async function sendTx(
  fromAddress: string,
  toAddress: string,
  amount: number,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Promise<string> {
  const nonce = await getNonce(fromAddress);
  const amountMu = Math.floor(amount * 1_000_000);
  const timestamp = Date.now() / 1000;

  const signingObject = {
    from: fromAddress,
    to_: toAddress,
    amount: amountMu.toString(),
    nonce: nonce + 1,
    ou: OU,
    timestamp,
  };

  const signingData = JSON.stringify(signingObject);
  const signature = nacl.sign.detached(new TextEncoder().encode(signingData), secretKey);

  const transaction = {
    ...signingObject,
    signature: Buffer.from(signature).toString('base64'),
    public_key: Buffer.from(publicKey).toString('base64'),
  };

  const res = await fetch(`${OCTRA_RPC_URL}/send-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`TX failed: ${text}`);

  try {
    const result = JSON.parse(text);
    return result.tx_hash || result.hash || text;
  } catch {
    const match = text.match(/([0-9a-fA-F]{64})/);
    return match ? match[1] : text;
  }
}

async function main() {
  const [sessionId, toAddress] = process.argv.slice(2);

  if (!sessionId || !toAddress) {
    console.log('Usage: npm run refund <sessionId> <toAddress>');
    process.exit(1);
  }

  // Get session
  const sessions = await db.select().from(gameWalletSessions)
    .where(eq(gameWalletSessions.id, sessionId)).limit(1);
  
  if (!sessions.length) {
    console.error('❌ Session not found');
    process.exit(1);
  }

  const session = sessions[0];
  console.log(`\n📋 Session: ${sessionId}`);
  console.log(`   Wallet: ${session.gameWalletAddress}`);

  // Get key
  const keys = await db.select().from(gameWalletKeys)
    .where(eq(gameWalletKeys.sessionId, sessionId)).limit(1);

  if (!keys.length) {
    console.error('❌ Key not found');
    process.exit(1);
  }

  const encryptedKey = {
    encryptedKey: keys[0].encryptedKey,
    iv: keys[0].iv,
    authTag: keys[0].authTag,
    salt: keys[0].salt,
  };

  // Get balance
  const balance = await getBalance(session.gameWalletAddress);
  console.log(`   Balance: ${balance.toFixed(6)} OCT`);

  if (balance <= 0.001) {
    console.error('❌ Insufficient balance');
    process.exit(1);
  }

  // Reserve gas
  const refundAmount = balance - 0.001;
  console.log(`\n💸 Refunding ${refundAmount.toFixed(6)} OCT to ${toAddress}`);

  // Get signing keypair
  const { secretKey, publicKey } = getSigningKeypair(encryptedKey, sessionId);

  // Send
  const txHash = await sendTx(
    session.gameWalletAddress,
    toAddress,
    refundAmount,
    secretKey,
    publicKey
  );

  console.log(`\n✅ TX: ${txHash}`);
  console.log(`   https://octrascan.io/transactions/${txHash}\n`);

  // Update session
  await db.update(gameWalletSessions)
    .set({ status: 'REFUNDED', settlementTxHash: txHash, settledAt: new Date() })
    .where(eq(gameWalletSessions.id, sessionId));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
