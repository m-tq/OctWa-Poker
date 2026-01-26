import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers.js';
import { TableManager } from './game/TableManager.js';
import { HandRepository } from './db/repositories/HandRepository.js';
import { UserRepository } from './db/repositories/UserRepository.js';
import {
  PORT,
  DEFAULT_SMALL_BLIND,
  DEFAULT_BIG_BLIND,
  DEFAULT_MIN_BUY_IN,
  DEFAULT_MAX_BUY_IN,
  DEFAULT_MAX_PLAYERS,
  GAME_WALLET_MASTER_PASSWORD,
} from './config.js';
import {
  createBuyInQuote,
  verifyDeposit,
  getSession,
  getGameWalletStats,
  withdrawFunds,
  claimWinnings,
  getPlayerGameWallets,
} from './gameWallet/index.js';

// Import database to ensure it's initialized
import './db/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5180', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

// Initialize table manager
const tableManager = new TableManager();

// Health check endpoint with stats
app.get('/health', async (_req, res) => {
  const gameWalletStats = await getGameWalletStats();
  res.json({ 
    status: 'ok', 
    tables: tableManager.getTableCount(),
    uptime: process.uptime(),
    gameWallet: gameWalletStats,
  });
});

// Get game configuration (default table settings)
app.get('/api/config', (_req, res) => {
  res.json({
    defaultSmallBlind: DEFAULT_SMALL_BLIND,
    defaultBigBlind: DEFAULT_BIG_BLIND,
    defaultMinBuyIn: DEFAULT_MIN_BUY_IN,
    defaultMaxBuyIn: DEFAULT_MAX_BUY_IN,
    defaultMaxPlayers: DEFAULT_MAX_PLAYERS,
    gameWalletEnabled: !!GAME_WALLET_MASTER_PASSWORD,
  });
});

// ============ GAME WALLET ENDPOINTS ============

// Get buy-in quote (step 1)
app.post('/api/game-wallet/quote', async (req, res) => {
  try {
    const { playerAddress, playerName, tableId, seatIndex, amount } = req.body;

    // Validate input
    if (!playerAddress || typeof playerAddress !== 'string' || playerAddress.length < 20) {
      return res.status(400).json({ error: 'Invalid player address' });
    }
    if (!playerName || typeof playerName !== 'string') {
      return res.status(400).json({ error: 'Invalid player name' });
    }
    if (!tableId || typeof tableId !== 'string') {
      return res.status(400).json({ error: 'Invalid table ID' });
    }
    if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex > 7) {
      return res.status(400).json({ error: 'Invalid seat index' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check if table exists
    const table = tableManager.getTable(tableId);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check buy-in limits
    if (amount < table.minBuyIn || amount > table.maxBuyIn) {
      return res.status(400).json({ 
        error: `Buy-in must be between ${table.minBuyIn} and ${table.maxBuyIn} OCT` 
      });
    }

    // Create quote
    const quote = await createBuyInQuote(playerAddress, playerName, tableId, seatIndex, amount);

    res.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error('Error creating buy-in quote:', error);
    res.status(500).json({ error: 'Failed to create buy-in quote' });
  }
});

// Verify deposit (step 2)
app.post('/api/game-wallet/verify', async (req, res) => {
  try {
    const { sessionId, txHash } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    if (!txHash || typeof txHash !== 'string') {
      return res.status(400).json({ error: 'Invalid transaction hash' });
    }

    const result = await verifyDeposit(sessionId, txHash);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Deposit verified successfully',
    });
  } catch (error) {
    console.error('Error verifying deposit:', error);
    res.status(500).json({ error: 'Failed to verify deposit' });
  }
});

// Get session status
app.get('/api/game-wallet/session/:sessionId', async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Return public session info (no encrypted keys)
    res.json({
      sessionId: session.sessionId,
      playerAddress: session.playerAddress,
      tableId: session.tableId,
      seatIndex: session.seatIndex,
      buyInAmount: session.buyInAmount,
      currentStack: session.currentStack,
      gameWalletAddress: session.gameWallet.octraAddress,
      status: session.status,
      depositTxHash: session.depositTxHash,
      settlementTxHash: session.settlementTxHash,
      claimableWinnings: session.claimableWinnings,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Withdraw funds from game wallet
app.post('/api/game-wallet/withdraw', async (req, res) => {
  try {
    const { sessionId, playerAddress, amount } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    if (!playerAddress || typeof playerAddress !== 'string') {
      return res.status(400).json({ error: 'Invalid player address' });
    }

    const result = await withdrawFunds(sessionId, playerAddress, amount);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      txHash: result.txHash,
      message: 'Withdrawal successful',
    });
  } catch (error) {
    console.error('Error withdrawing funds:', error);
    res.status(500).json({ error: 'Failed to withdraw funds' });
  }
});

// Claim winnings from another player's game wallet
app.post('/api/game-wallet/claim', async (req, res) => {
  try {
    const { sessionId, fromSessionId, playerAddress } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    if (!fromSessionId || typeof fromSessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid source session ID' });
    }
    if (!playerAddress || typeof playerAddress !== 'string') {
      return res.status(400).json({ error: 'Invalid player address' });
    }

    const result = await claimWinnings(sessionId, fromSessionId, playerAddress);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      txHash: result.txHash,
      message: 'Winnings claimed successfully',
    });
  } catch (error) {
    console.error('Error claiming winnings:', error);
    res.status(500).json({ error: 'Failed to claim winnings' });
  }
});

// Get all game wallets for a player (for dashboard)
app.get('/api/game-wallet/player/:address', async (req, res) => {
  try {
    const wallets = await getPlayerGameWallets(req.params.address);
    res.json(wallets);
  } catch (error) {
    console.error('Error fetching player game wallets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ LEGACY ESCROW ENDPOINTS (for backward compatibility) ============
app.post('/api/escrow/quote', async (req, res) => {
  try {
    const { playerAddress, playerName, tableId, seatIndex, amount } = req.body;
    const table = tableManager.getTable(tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const quote = await createBuyInQuote(playerAddress, playerName, tableId, seatIndex, amount);
    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create buy-in quote' });
  }
});

app.post('/api/escrow/verify', async (req, res) => {
  try {
    const { sessionId, txHash } = req.body;
    const result = await verifyDeposit(sessionId, txHash);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Deposit verified successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify deposit' });
  }
});

app.get('/api/escrow/session/:sessionId', async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({
      sessionId: session.sessionId,
      playerAddress: session.playerAddress,
      tableId: session.tableId,
      seatIndex: session.seatIndex,
      buyInAmount: session.buyInAmount,
      currentStack: session.currentStack,
      gameWalletAddress: session.gameWallet.octraAddress,
      status: session.status,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tables
app.get('/api/tables', (_req, res) => {
  res.json(tableManager.getAllTables());
});

// Get user stats by address
app.get('/api/users/:address/stats', async (req, res) => {
  try {
    const user = await UserRepository.findByAddress(req.params.address);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      address: user.address,
      name: user.name,
      handsPlayed: user.handsPlayed,
      handsWon: user.handsWon,
      winRate: user.handsPlayed > 0 ? (user.handsWon / user.handsPlayed * 100).toFixed(1) : 0,
      totalWinnings: user.totalWinnings,
      totalLosses: user.totalLosses,
      netProfit: user.totalWinnings - user.totalLosses,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get hand history for a user
app.get('/api/users/:address/history', async (req, res) => {
  try {
    const user = await UserRepository.findByAddress(req.params.address);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const hands = await HandRepository.getHandHistory(user.id, limit);
    res.json(hands);
  } catch (error) {
    console.error('Error fetching hand history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get hand details
app.get('/api/hands/:handId', async (req, res) => {
  try {
    const details = await HandRepository.getHandDetails(req.params.handId);
    if (!details) {
      return res.status(404).json({ error: 'Hand not found' });
    }

    // Enrich players with their addresses
    const enrichedPlayers = await Promise.all(
      details.players.map(async (player) => {
        const user = await UserRepository.findById(player.userId);
        return {
          ...player,
          userAddress: user?.address || null,
          userName: user?.name || 'Unknown',
        };
      })
    );

    res.json({
      hand: details.hand,
      players: enrichedPlayers,
      actions: details.actions,
    });
  } catch (error) {
    console.error('Error fetching hand details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const users = await UserRepository.getLeaderboard(limit);
    res.json(users.map(u => ({
      address: u.address,
      name: u.name,
      handsPlayed: u.handsPlayed,
      handsWon: u.handsWon,
      totalWinnings: u.totalWinnings,
      netProfit: u.totalWinnings - u.totalLosses,
    })));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Username validation regex
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,16}$/;

// Register new user / set username
app.post('/api/users/register', async (req, res) => {
  try {
    const { address, name } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!USERNAME_REGEX.test(name)) {
      return res.status(400).json({ error: 'Username must be 3-16 characters, letters and numbers only' });
    }

    // Create or update user
    const user = await UserRepository.findOrCreate(address, name);
    
    res.json({
      success: true,
      user: {
        address: user.address,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update username
app.post('/api/users/update-username', async (req, res) => {
  try {
    const { address, name } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!USERNAME_REGEX.test(name)) {
      return res.status(400).json({ error: 'Username must be 3-16 characters, letters and numbers only' });
    }

    const user = await UserRepository.findByAddress(address);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await UserRepository.updateName(user.id, name);
    
    res.json({
      success: true,
      name,
    });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user exists
app.get('/api/users/:address/exists', async (req, res) => {
  try {
    const user = await UserRepository.findByAddress(req.params.address);
    res.json({
      exists: !!user,
      name: user?.name || null,
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Setup socket handlers
setupSocketHandlers(io, tableManager);

// Initialize and start server
async function start() {
  try {
    // Initialize table manager (loads tables from database)
    await tableManager.initialize();
    
    httpServer.listen(PORT, () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🎰 OCT Poker Server running on port ${PORT}`);
        console.log(`📊 Database: SQLite (data/poker.db)`);
        console.log(`💰 Game Wallet: ${GAME_WALLET_MASTER_PASSWORD ? 'Enabled' : 'Disabled'}`);
      } else {
        console.log(`🎰 OCT Poker Server running on port ${PORT} (Production)`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
