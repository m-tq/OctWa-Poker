/**
 * Escrow Types for OCT Poker
 * Secure buy-in with unique escrow wallet per session
 */

// Encrypted escrow key (never store plaintext!)
export interface EncryptedEscrowKey {
  encryptedKey: string; // AES-256-GCM encrypted private key
  iv: string; // Initialization vector (base64)
  authTag: string; // Authentication tag (base64)
  salt: string; // Salt used for key derivation
}

// Escrow wallet info (public data only)
export interface EscrowWallet {
  sessionId: string;
  octraAddress: string; // Octra escrow address for receiving buy-in
  createdAt: number;
}

// Buy-in session status
export type BuyInStatus =
  | 'PENDING' // Waiting for on-chain deposit
  | 'CONFIRMED' // Deposit confirmed, player can play
  | 'PLAYING' // Player is actively playing
  | 'SETTLING' // Game ended, settling funds
  | 'COMPLETED' // Funds distributed
  | 'REFUNDED' // Funds refunded (e.g., table closed)
  | 'EXPIRED'; // Session expired without deposit

// Buy-in session
export interface BuyInSession {
  sessionId: string;
  
  // Player info
  playerAddress: string; // Player's wallet address
  playerName: string;
  
  // Table info
  tableId: string;
  seatIndex: number;
  
  // Buy-in details
  buyInAmount: number; // Amount in OCT
  currentStack: number; // Current chip stack
  
  // Escrow info
  escrow: EscrowWallet;
  
  // Transaction info
  depositTxHash?: string; // On-chain deposit transaction
  depositConfirmedAt?: number;
  
  // Settlement info
  finalStack?: number; // Stack at end of session
  settlementTxHash?: string; // Payout transaction
  settledAt?: number;
  
  // Status
  status: BuyInStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number; // Session expires if no deposit
  
  // Message payload (for verification)
  messagePayload: BuyInMessagePayload;
}

// Message payload for buy-in (sent with transaction)
export interface BuyInMessagePayload {
  address: string;
  amount: number;
  username: string;
  timestamp: number;
  tableId: string;
  seatIndex: number;
  nonce: string; // Unique nonce for replay protection
}

// Quote response (before buy-in)
export interface BuyInQuote {
  sessionId: string;
  escrowAddress: string; // Where to send OCT
  amount: number;
  expiresAt: number;
  messagePayload: BuyInMessagePayload;
  encodedMessage: string; // Base64 encoded message to include in transaction
}

// Verify deposit request
export interface VerifyDepositRequest {
  sessionId: string;
  txHash: string;
}

// Cash-out request
export interface CashOutRequest {
  sessionId: string;
  playerAddress: string;
}
