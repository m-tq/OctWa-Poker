/**
 * Game Wallet Cryptography Module for OCT Poker
 *
 * SECURITY CRITICAL:
 * - AES-256-GCM encryption for private keys
 * - PBKDF2-SHA512 key derivation (100k iterations)
 * - Unique salt per session
 * - Master password required for decryption
 */

import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
} from 'crypto';
import nacl from 'tweetnacl';
import type { EncryptedGameWalletKey, GameWallet } from './types.js';
import { GAME_WALLET_MASTER_PASSWORD } from '../config.js';

// AES-256-GCM parameters
const AES_KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = 'sha512';

/**
 * Get master password from config
 */
function getMasterPassword(): string {
  if (!GAME_WALLET_MASTER_PASSWORD) {
    throw new Error(
      'SECURITY ERROR: GAME_WALLET_MASTER_PASSWORD not configured'
    );
  }

  if (process.env.NODE_ENV === 'production' && GAME_WALLET_MASTER_PASSWORD.length < 32) {
    throw new Error(
      'SECURITY ERROR: GAME_WALLET_MASTER_PASSWORD must be at least 32 characters in production'
    );
  }

  return GAME_WALLET_MASTER_PASSWORD;
}

/**
 * Derive encryption key from sessionId, salt, and master password
 */
function deriveEncryptionKey(sessionId: string, salt: Buffer): Buffer {
  const masterPassword = getMasterPassword();
  const password = `${masterPassword}:poker:${sessionId}`;
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, AES_KEY_LENGTH, PBKDF2_HASH);
}

/**
 * Encrypt private key for storage
 */
export function encryptPrivateKey(privateKey: Uint8Array, sessionId: string): EncryptedGameWalletKey {
  if (!privateKey || privateKey.length !== 32) {
    throw new Error('Invalid private key: must be 32 bytes');
  }

  const salt = randomBytes(SALT_LENGTH);
  const encryptionKey = deriveEncryptionKey(sessionId, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(privateKey)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Clear sensitive data
  encryptionKey.fill(0);

  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

/**
 * Decrypt private key for transaction signing
 */
export function decryptPrivateKey(encryptedData: EncryptedGameWalletKey, sessionId: string): Uint8Array {
  if (!encryptedData?.encryptedKey || !encryptedData?.iv || !encryptedData?.authTag || !encryptedData?.salt) {
    throw new Error('Invalid encrypted data: missing required fields');
  }

  const salt = Buffer.from(encryptedData.salt, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const encrypted = Buffer.from(encryptedData.encryptedKey, 'base64');

  const encryptionKey = deriveEncryptionKey(sessionId, salt);

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    encryptionKey.fill(0);
    throw new Error('Decryption failed: Invalid master password or data tampered');
  }

  encryptionKey.fill(0);
  return new Uint8Array(decrypted);
}

/**
 * Base58 encoding (Bitcoin-style)
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer: Buffer): string {
  if (buffer.length === 0) return '';
  
  let num = BigInt('0x' + buffer.toString('hex'));
  let encoded = '';
  
  while (num > 0n) {
    const remainder = num % 58n;
    num = num / 58n;
    encoded = BASE58_ALPHABET[Number(remainder)] + encoded;
  }
  
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    encoded = '1' + encoded;
  }
  
  return encoded;
}

/**
 * Generate Octra address from public key
 * Format: "oct" + base58(sha256(publicKey))
 * Valid length: 47 characters
 */
function createOctraAddress(publicKey: Uint8Array): string {
  const hash = createHash('sha256').update(publicKey).digest();
  const base58Hash = base58Encode(hash);
  return 'oct' + base58Hash;
}

/**
 * Validate Octra address format
 */
function isValidOctraAddress(address: string): boolean {
  return address.length === 47 && address.startsWith('oct');
}

/**
 * Generate unique game wallet for a buy-in session
 */
export async function generateGameWallet(sessionId: string): Promise<{
  gameWallet: GameWallet;
  encryptedKey: EncryptedGameWalletKey;
}> {
  const maxAttempts = 100;
  let attempts = 0;
  
  let seed: Buffer;
  let keyPair: nacl.SignKeyPair;
  let octraAddress: string;
  
  // Retry until valid 47-character address
  do {
    seed = randomBytes(32);
    keyPair = nacl.sign.keyPair.fromSeed(seed);
    octraAddress = createOctraAddress(keyPair.publicKey);
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate game wallet with valid address');
    }
  } while (!isValidOctraAddress(octraAddress));
  
  const privateKey = seed;
  const encryptedKey = encryptPrivateKey(privateKey, sessionId);
  
  const gameWallet: GameWallet = {
    sessionId,
    octraAddress,
    createdAt: Date.now(),
  };
  
  console.log(`[GAME-WALLET] Generated wallet for session ${sessionId.slice(0, 8)}...`);
  console.log(`[GAME-WALLET]   Address: ${octraAddress}`);
  
  return { gameWallet, encryptedKey };
}

/**
 * Get signing keypair for transaction execution
 */
export function getSigningKeypair(
  encryptedKey: EncryptedGameWalletKey,
  sessionId: string
): { privateKey: Uint8Array; publicKey: Uint8Array; secretKey: Uint8Array } {
  const privateKey = decryptPrivateKey(encryptedKey, sessionId);
  const keyPair = nacl.sign.keyPair.fromSeed(privateKey);

  return {
    privateKey,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  };
}

/**
 * Verify decryption capability
 */
export function canDecryptKey(encryptedKey: EncryptedGameWalletKey, sessionId: string): boolean {
  try {
    const decrypted = decryptPrivateKey(encryptedKey, sessionId);
    const isValid = decrypted.length === 32;
    decrypted.fill(0);
    return isValid;
  } catch {
    return false;
  }
}
