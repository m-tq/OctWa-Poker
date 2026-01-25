/**
 * Octra Chain Integration for OCT Poker
 * Handles on-chain transaction verification and sending
 * 
 * SECURITY CRITICAL:
 * - Always verify tx exists and is CONFIRMED (not pending/staging)
 * - Verify amount matches expected
 * - Verify recipient is game wallet address
 * - Verify sender matches player address
 * - Uses epoch-based confirmation (waits for epoch change)
 */

import nacl from 'tweetnacl';
import type { EncryptedGameWalletKey } from './types.js';
import { getSigningKeypair } from './gameWalletCrypto.js';
import {
  OCTRA_RPC_URL,
  EPOCH_POLL_INTERVAL_MS,
  MAX_EPOCH_CHANGES,
  DEFAULT_OU,
  FALLBACK_OU,
} from '../config.js';

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get current epoch from Octra network
 */
async function getCurrentEpoch(): Promise<number> {
  try {
    const response = await fetch(`${OCTRA_RPC_URL}/status`);
    if (!response.ok) return -1;
    const data = (await response.json()) as { epoch?: number; current_epoch?: number };
    return data.epoch ?? data.current_epoch ?? -1;
  } catch {
    return -1;
  }
}

/**
 * Get balance of an Octra address
 */
export async function getOctraBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${OCTRA_RPC_URL}/balance/${address}`);
    if (!response.ok) return 0;
    const data = (await response.json()) as { balance?: number; amount?: number };
    // Balance is in micro units (MU), convert to OCT
    const balanceMu = data.balance ?? data.amount ?? 0;
    return balanceMu / 1_000_000;
  } catch (error) {
    console.error(`[OCTRA] Failed to get balance for ${address}:`, error);
    return 0;
  }
}

/**
 * Get nonce for an Octra address
 */
async function getOctraNonce(address: string): Promise<number> {
  try {
    const response = await fetch(`${OCTRA_RPC_URL}/balance/${address}`);
    if (!response.ok) return 0;
    const data = (await response.json()) as { nonce?: number };
    return data.nonce ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean;
  error?: string;
  extractedData?: {
    from: string;
    to: string;
    amount: number;
    message?: string;
  };
}

/**
 * Helper to validate transaction details
 */
function validateTxDetails(
  from: string,
  to: string,
  amountMu: number,
  expectedTo: string,
  expectedAmount: number,
  expectedFrom?: string,
  message?: string
): { valid: boolean; error?: string; details?: { from: string; to: string; amount: number; message?: string } } {
  // Convert from micro units to OCT
  const amount = amountMu / 1_000_000;

  // SECURITY: Verify sender address matches expected
  if (expectedFrom && from !== expectedFrom) {
    return {
      valid: false,
      error: `Invalid sender. Expected ${expectedFrom}, got ${from}. Someone else sent this transaction.`,
    };
  }

  // Verify recipient
  if (to !== expectedTo) {
    return {
      valid: false,
      error: `Invalid recipient. Expected ${expectedTo}, got ${to}`,
    };
  }

  // Verify amount (with 0.1% tolerance for rounding)
  const tolerance = expectedAmount * 0.001;
  if (amount < expectedAmount - tolerance) {
    return {
      valid: false,
      error: `Insufficient amount. Expected ${expectedAmount} OCT, got ${amount.toFixed(6)} OCT`,
    };
  }

  return {
    valid: true,
    details: { from, to, amount, message },
  };
}

/**
 * Verify OCT transaction on Octra network using epoch-based confirmation
 * 
 * CRITICAL: Waits until transaction is CONFIRMED (not in staging) before returning valid
 * Fails if transaction not confirmed after MAX_EPOCH_CHANGES epoch changes
 * 
 * SECURITY: Verifies sender address matches expected player
 */
export async function verifyOctTransaction(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  expectedFrom?: string,
  expectedMessage?: string
): Promise<VerificationResult> {
  console.log(`[OCTRA] Starting epoch-based verification for tx: ${txHash}`);
  console.log(`[OCTRA]   Expected to: ${expectedTo}`);
  console.log(`[OCTRA]   Expected amount: ${expectedAmount} OCT`);
  if (expectedFrom) console.log(`[OCTRA]   Expected from: ${expectedFrom}`);

  // Get initial epoch
  const initialEpoch = await getCurrentEpoch();
  console.log(`[OCTRA] Initial epoch: ${initialEpoch}`);

  let epochChanges = 0;
  let lastEpoch = initialEpoch;
  let txValidated = false;
  let txDetails: { from: string; to: string; amount: number; message?: string } | null = null;

  while (epochChanges < MAX_EPOCH_CHANGES) {
    try {
      // Check current epoch
      const currentEpoch = await getCurrentEpoch();
      if (currentEpoch > lastEpoch && lastEpoch !== -1) {
        epochChanges++;
        console.log(`[OCTRA] Epoch changed: ${lastEpoch} -> ${currentEpoch} (change #${epochChanges})`);
        lastEpoch = currentEpoch;
      }

      // Check transaction status via /tx endpoint
      const txResponse = await fetch(`${OCTRA_RPC_URL}/tx/${txHash}`);

      if (txResponse.ok) {
        const txData = (await txResponse.json()) as {
          tx_hash?: string;
          status?: string;
          in_staging?: boolean;
          confirmed?: boolean;
          parsed_tx?: {
            from: string;
            to: string;
            amount: string;
            timestamp: number;
            message?: string;
          };
        };

        // Validate transaction details (only once)
        if (!txValidated && txData.parsed_tx) {
          const amountMu = parseFloat(txData.parsed_tx.amount);
          const validation = validateTxDetails(
            txData.parsed_tx.from,
            txData.parsed_tx.to,
            amountMu,
            expectedTo,
            expectedAmount,
            expectedFrom,
            txData.parsed_tx.message
          );

          if (!validation.valid) {
            return {
              valid: false,
              error: validation.error,
              extractedData: {
                from: txData.parsed_tx.from,
                to: txData.parsed_tx.to,
                amount: amountMu / 1_000_000,
                message: txData.parsed_tx.message,
              },
            };
          }

          txValidated = true;
          txDetails = validation.details!;
          console.log(`[OCTRA] Transaction validated: ${txDetails.amount.toFixed(6)} OCT from ${txDetails.from} to ${txDetails.to}`);
        }

        // CRITICAL: Only accept if status is explicitly "confirmed"
        // Do NOT accept if still in staging or pending
        const isConfirmed = txData.status === 'confirmed';

        if (isConfirmed) {
          if (txValidated && txDetails) {
            console.log(`[OCTRA] Transaction CONFIRMED (status: ${txData.status}) after ${epochChanges} epoch change(s)`);
            return {
              valid: true,
              extractedData: txDetails,
            };
          }
        } else {
          console.log(`[OCTRA] Transaction NOT confirmed yet (epoch: ${currentEpoch}, status: ${txData.status}, in_staging: ${txData.in_staging})`);
        }
      } else {
        // Transaction not found via /tx, check staging endpoint
        const stagingResponse = await fetch(`${OCTRA_RPC_URL}/staging`);
        if (stagingResponse.ok) {
          const stagingData = (await stagingResponse.json()) as {
            staged_transactions?: Array<{
              hash: string;
              from: string;
              to: string;
              amount: string;
              message?: string;
            }>;
          };

          if (stagingData.staged_transactions) {
            const pendingTx = stagingData.staged_transactions.find((tx) => tx.hash === txHash);
            if (pendingTx) {
              // Validate details from staging (only once)
              if (!txValidated) {
                const amountMu = parseFloat(pendingTx.amount);
                const validation = validateTxDetails(
                  pendingTx.from,
                  pendingTx.to,
                  amountMu,
                  expectedTo,
                  expectedAmount,
                  expectedFrom,
                  pendingTx.message
                );

                if (!validation.valid) {
                  return {
                    valid: false,
                    error: validation.error,
                    extractedData: {
                      from: pendingTx.from,
                      to: pendingTx.to,
                      amount: amountMu / 1_000_000,
                      message: pendingTx.message,
                    },
                  };
                }

                txValidated = true;
                txDetails = validation.details!;
                console.log(`[OCTRA] Transaction found in staging: ${txDetails.amount.toFixed(6)} OCT from ${txDetails.from} to ${txDetails.to}`);
              }
              // Transaction is in staging - DO NOT return valid yet, keep waiting
              console.log(`[OCTRA] Waiting for confirmation (still in staging)... (epoch: ${currentEpoch})`);
            }
          }
        }
      }

      // Wait before next poll
      await sleep(EPOCH_POLL_INTERVAL_MS);
    } catch (error) {
      console.error(`[OCTRA] Verification error:`, error);
      await sleep(EPOCH_POLL_INTERVAL_MS);
    }
  }

  // Failed after max epoch changes
  if (txValidated && txDetails) {
    return {
      valid: false,
      error: `Transaction validated but NOT CONFIRMED after ${MAX_EPOCH_CHANGES} epoch changes. Transaction may still be in staging.`,
      extractedData: txDetails,
    };
  }

  return { valid: false, error: 'Transaction not found after max retries' };
}

/**
 * Send OCT transaction from game wallet
 */
export async function sendOctTransaction(
  encryptedKey: EncryptedGameWalletKey,
  sessionId: string,
  fromAddress: string,
  toAddress: string,
  amount: number,
  message?: string
): Promise<string> {
  console.log(`[OCTRA] Sending ${amount} OCT from ${fromAddress} to ${toAddress}`);

  // Get signing keypair
  const { secretKey, publicKey } = getSigningKeypair(encryptedKey, sessionId);

  // Convert to micro units (× 1,000,000)
  const MU_FACTOR = 1_000_000;
  const amountMu = Math.floor(amount * MU_FACTOR);

  // Get current nonce
  const nonce = await getOctraNonce(fromAddress);

  // Create transaction
  const timestamp = Date.now() / 1000;
  let ou = DEFAULT_OU;

  // Try with default OU first
  let txHash = await trySubmitTransaction(
    fromAddress,
    toAddress,
    amountMu,
    nonce + 1,
    ou,
    timestamp,
    message,
    secretKey,
    publicKey
  );

  // If failed, retry with higher OU
  if (!txHash) {
    console.log(`[OCTRA] Retrying with higher OU (${FALLBACK_OU})`);
    ou = FALLBACK_OU;
    txHash = await trySubmitTransaction(
      fromAddress,
      toAddress,
      amountMu,
      nonce + 1,
      ou,
      timestamp,
      message,
      secretKey,
      publicKey
    );
  }

  if (!txHash) {
    throw new Error('Failed to submit transaction after retries');
  }

  console.log(`[OCTRA] Transaction submitted: ${txHash}`);
  return txHash;
}

/**
 * Try to submit a transaction
 */
async function trySubmitTransaction(
  from: string,
  to: string,
  amountMu: number,
  nonce: number,
  ou: string,
  timestamp: number,
  message: string | undefined,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Promise<string | null> {
  try {
    // Create signing object
    const signingObject: Record<string, unknown> = {
      from,
      to_: to,
      amount: amountMu.toString(),
      nonce,
      ou,
      timestamp,
    };

    if (message) {
      signingObject.message = message;
    }

    const signingData = JSON.stringify(signingObject);

    // Sign with nacl
    const signature = nacl.sign.detached(new TextEncoder().encode(signingData), secretKey);

    // Build full transaction
    const transaction = {
      ...signingObject,
      signature: Buffer.from(signature).toString('base64'),
      public_key: Buffer.from(publicKey).toString('base64'),
    };

    // Submit to Octra network
    const response = await fetch(`${OCTRA_RPC_URL}/send-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[OCTRA] Transaction failed: ${responseText}`);
      return null;
    }

    // Parse response
    try {
      const result = JSON.parse(responseText);
      return result.tx_hash || result.hash || null;
    } catch {
      const hashMatch = responseText.match(/([0-9a-fA-F]{64})/);
      if (hashMatch) return hashMatch[1];
      return responseText;
    }
  } catch (error) {
    console.error(`[OCTRA] Transaction error:`, error);
    return null;
  }
}

/**
 * Wait for transaction confirmation using epoch-based approach
 */
export async function waitForConfirmation(txHash: string, maxEpochChanges: number = 5): Promise<boolean> {
  const initialEpoch = await getCurrentEpoch();
  let epochChanges = 0;
  let lastEpoch = initialEpoch;

  while (epochChanges < maxEpochChanges) {
    try {
      const currentEpoch = await getCurrentEpoch();
      if (currentEpoch > lastEpoch && lastEpoch !== -1) {
        epochChanges++;
        lastEpoch = currentEpoch;
      }

      const response = await fetch(`${OCTRA_RPC_URL}/tx/${txHash}`);
      if (response.ok) {
        const data = (await response.json()) as { status?: string };
        if (data.status === 'confirmed') {
          return true;
        }
      }
    } catch {
      // Ignore errors, keep polling
    }

    await sleep(EPOCH_POLL_INTERVAL_MS);
  }

  return false;
}
