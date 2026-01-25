/**
 * Game Wallet Types for OCT Poker
 * Secure buy-in with unique game wallet per session
 */

// Encrypted game wallet key (never store plaintext!)
export interface EncryptedGameWalletKey {
  encryptedKey: string; // AES-256-GCM encrypted private key
  iv: string; // Initialization vector (base64)
  authTag: string; // Authentication tag (base64)
  salt: string; // Salt used for key derivation
}

// Game wallet info (public data only)
export interface GameWallet {
  sessionId: string;
  octraAddress: string; // Octra game wallet address for receiving buy-in
  createdAt: number;
}

// Buy-in session status
export type GameWalletStatus =
  | 'PENDING' // Waiting for on-chain deposit
  | 'CONFIRMED' // Deposit confirmed, player can play
  | 'PLAYING' // Player is actively playing
  | 'SETTLING' // Game ended, settling funds
  | 'COMPLETED' // Funds distributed
  | 'REFUNDED' // Funds refunded (e.g., table closed)
  | 'EXPIRED'; // Session expired without deposit

// Game wallet session
export interface GameWalletSession {
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
  
  // Game wallet info
  gameWallet: GameWallet;
  
  // Transaction info
  depositTxHash?: string; // On-chain deposit transaction
  depositConfirmedAt?: number;
  
  // Settlement info
  finalStack?: number; // Stack at end of session
  settlementTxHash?: string; // Payout transaction
  settledAt?: number;
  
  // Winnings from other players (claimable)
  claimableWinnings: ClaimableWinning[];
  
  // Status
  status: GameWalletStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number; // Session expires if no deposit
  
  // Message payload (for verification)
  messagePayload: BuyInMessagePayload;
}

// Claimable winning from another player's game wallet
export interface ClaimableWinning {
  fromSessionId: string; // Session ID of the losing player
  fromAddress: string; // Address of the losing player
  amount: number; // Amount won
  claimed: boolean;
  claimTxHash?: string;
  claimedAt?: number;
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
  gameWalletAddress: string; // Where to send OCT
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

// Withdraw request
export interface WithdrawRequest {
  sessionId: string;
  playerAddress: string;
  amount?: number; // Optional, defaults to full balance
}

// Claim winnings request
export interface ClaimWinningsRequest {
  sessionId: string;
  fromSessionId: string;
  playerAddress: string;
}

// Player game wallet info (for dashboard)
export interface PlayerGameWalletInfo {
  sessionId: string;
  gameWalletAddress: string;
  tableId: string;
  buyInAmount: number;
  currentStack: number;
  status: GameWalletStatus;
  claimableWinnings: ClaimableWinning[];
  historyWinnings?: ClaimableWinning[];
  settlementTxHash?: string;
  settledAt?: number;
  withdrawableAmount: number;
  createdAt: number;
}
