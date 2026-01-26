import { Server, Socket } from 'socket.io';
import { TableManager } from '../game/TableManager.js';
import { GameManager } from '../game/GameManager.js';
import {
  validateCreateTableData,
  validateJoinTableData,
  validatePlayerActionData,
  validateRejoinData,
  validateLeaveTableData,
} from '../utils/validation.js';
import { ActionRateLimiter } from '../utils/rateLimiter.js';
import { ExponentialBackoffLimiter, ActionSequenceValidator } from '../utils/security.js';
import { HandRepository } from '../db/repositories/HandRepository.js';
import { UserRepository } from '../db/repositories/UserRepository.js';
import { completeSession, getSession, startPlaying, updateStack, recordWinnings } from '../gameWallet/index.js';
import { TURN_TIMEOUT_MS, DISCONNECT_GRACE_MS } from '../config.js';
import type { Table, Player, HandResult } from '../types/index.js';

// Game managers per table
const gameManagers: Map<string, GameManager> = new Map();

// Rate limiter instance
const rateLimiter = new ActionRateLimiter();

// Security: Exponential backoff for repeated violations
const violationLimiter = new ExponentialBackoffLimiter();

// Security: Action timing validator (bot detection)
const actionValidator = new ActionSequenceValidator(100); // Min 100ms between actions

// Track which addresses are currently playing at which tables
const addressTableMap: Map<string, Set<string>> = new Map();

// Lock for preventing race conditions on hand operations
const handLocks: Map<string, boolean> = new Map();

function acquireHandLock(tableId: string): boolean {
  if (handLocks.get(tableId)) return false;
  handLocks.set(tableId, true);
  return true;
}

function releaseHandLock(tableId: string): void {
  handLocks.delete(tableId);
}

function getGameManager(tableId: string): GameManager {
  let manager = gameManagers.get(tableId);
  if (!manager) {
    manager = new GameManager();
    gameManagers.set(tableId, manager);
  }
  return manager;
}

// Helper to sanitize table for client (hide other players' hole cards)
function sanitizeTableForPlayer(table: Table, playerId?: string): Table {
  return {
    ...table,
    players: table.players.map((p) => {
      if (!p) return null;
      return {
        ...p,
        holeCards: p.id === playerId ? p.holeCards : null,
      };
    }),
  };
}

// Broadcast table state to all connected players
function broadcastTableState(io: Server, table: Table): void {
  for (const player of table.players) {
    if (player && player.isConnected) {
      io.to(player.socketId).emit('table-state', sanitizeTableForPlayer(table, player.id));
    }
  }
}

// Track hand numbers per table
const tableHandNumbers: Map<string, number> = new Map();

// Save hand history to database
async function saveHandHistory(
  tableId: string,
  table: Table,
  handResult: HandResult,
  communityCards: string[],
  pot: number,
  dealerSeat: number,
  sbSeat: number,
  bbSeat: number,
  playerStartingStacks: Map<string, number>
): Promise<void> {
  try {
    // Get or increment hand number for this table
    const handNumber = (tableHandNumbers.get(tableId) || 0) + 1;
    tableHandNumbers.set(tableId, handNumber);

    // Create hand record
    const hand = await HandRepository.create({
      tableId,
      handNumber,
      dealerSeat,
      smallBlindSeat: sbSeat,
      bigBlindSeat: bbSeat,
    });

    // Get winner IDs
    const winnerIds = new Set(handResult.winners.map((w) => w.playerId));

    // Add player records
    for (const player of table.players) {
      if (!player) continue;

      const startingStack = playerStartingStacks.get(player.id) || player.stack;
      const winAmount = handResult.winners.find((w) => w.playerId === player.id)?.amount || 0;
      const showdownInfo = handResult.showdown?.find((s) => s.playerId === player.id);

      let result: 'won' | 'lost' | 'folded' | 'split' = 'lost';
      if (winnerIds.has(player.id)) {
        result = handResult.winners.length > 1 ? 'split' : 'won';
      } else if (player.status === 'folded') {
        result = 'folded';
      }

      // Get user from database by address
      const user = await UserRepository.findByAddress(player.address);
      if (user) {
        await HandRepository.addPlayer({
          handId: hand.id,
          userId: user.id,
          seatIndex: player.seatIndex,
          holeCards: showdownInfo?.holeCards?.map((c) => `${c.rank}${c.suit}`) || null,
          startingStack,
          endingStack: player.stack,
          totalBet: startingStack - player.stack + winAmount,
          won: winAmount,
          finalHand: showdownInfo?.hand || null,
          result,
        });

        // Update user stats (incremental)
        const isWinner = winnerIds.has(player.id);
        const lossAmount = Math.max(0, startingStack - player.stack);
        await UserRepository.updateStats(user.id, {
          handsPlayed: 1,
          handsWon: isWinner ? 1 : 0,
          totalWinnings: winAmount,
          totalLosses: isWinner ? 0 : lossAmount,
        });
      }
    }

    // Complete hand record - store address in winnersJson for frontend matching
    const winnersWithAddress = handResult.winners.map(w => {
      const player = table.players.find(p => p?.id === w.playerId);
      return {
        ...w,
        address: player?.address || null,
      };
    });

    await HandRepository.complete(hand.id, {
      communityCards,
      pot,
      winnersJson: winnersWithAddress,
    });

    console.log(`[DB] Hand ${handNumber} saved for table ${tableId}`);
  } catch (error) {
    console.error('[DB] Failed to save hand history:', error);
  }
}

async function settleGameWallets(
  tableManager: TableManager,
  table: Table,
  handResult: HandResult,
  startingStacks: Map<string, number>
): Promise<void> {
  const winners = handResult.winners;
  const totalWin = winners.reduce((sum, w) => sum + w.amount, 0);
  if (totalWin <= 0) return;

  const losses = table.players
    .filter((p): p is Player => p !== null)
    .map((player) => {
      const startingStack = startingStacks.get(player.id);
      if (startingStack === undefined) return null;
      const delta = player.stack - startingStack;
      return delta < 0 ? { player, loss: -delta } : null;
    })
    .filter((entry): entry is { player: Player; loss: number } => entry !== null);

  if (losses.length === 0) return;

  const recordPromises: Promise<void>[] = [];

  for (const loser of losses) {
    const loserSessionId = tableManager.getGameWalletSessionId(loser.player.id);
    if (!loserSessionId) continue;

    let allocated = 0;
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const winnerSessionId = tableManager.getGameWalletSessionId(winner.playerId);
      if (!winnerSessionId) continue;

      let amount = 0;
      if (i === winners.length - 1) {
        amount = Number((loser.loss - allocated).toFixed(6));
      } else {
        amount = Number(((loser.loss * winner.amount) / totalWin).toFixed(6));
        allocated += amount;
      }

      if (amount <= 0) continue;

      recordPromises.push(
        recordWinnings(winnerSessionId, loserSessionId, loser.player.address, amount)
      );
    }
  }

  await Promise.all(recordPromises);

  const updatePromises = table.players
    .filter((p): p is Player => p !== null)
    .map((player) => {
      const sessionId = tableManager.getGameWalletSessionId(player.id);
      if (!sessionId) return null;
      return updateStack(sessionId, player.stack);
    })
    .filter((promise): promise is Promise<boolean> => promise !== null);

  await Promise.all(updatePromises);
}

export function setupSocketHandlers(io: Server, tableManager: TableManager): void {
  // Track socket ID to IP mapping for cleanup
  const socketIPMap: Map<string, string> = new Map();

  /**
   * Get client IP from socket
   */
  function getClientIP(socket: Socket): string {
    // Try x-forwarded-for header first (for proxies/load balancers)
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }
    // Fall back to direct connection IP
    return socket.handshake.address || 'unknown';
  }

  io.on('connection', (socket: Socket) => {
    const clientIP = getClientIP(socket);

    // Security: Check if IP is blocked
    if (rateLimiter.isIPBlocked(clientIP)) {
      console.log(`[Security] Blocked IP ${clientIP} attempted connection`);
      socket.emit('error', { code: 'IP_BLOCKED', message: 'Too many connections. Please try again later.' });
      socket.disconnect(true);
      return;
    }

    // Security: Register connection and check limit
    if (!rateLimiter.registerConnection(clientIP, socket.id)) {
      console.log(`[Security] IP ${clientIP} exceeded connection limit`);
      socket.emit('error', { code: 'CONNECTION_LIMIT', message: 'Too many connections from your IP.' });
      socket.disconnect(true);
      return;
    }

    // Store IP mapping for cleanup on disconnect
    socketIPMap.set(socket.id, clientIP);

    console.log(`Client connected: ${socket.id} from IP: ${clientIP.slice(0, 10)}***`);

    // Get tables list
    socket.on('get-tables', () => {
      if (!rateLimiter.isGeneralAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }
      const tables = tableManager.getAllTables();
      socket.emit('tables-list', tables);
    });

    // Get user stats and history
    socket.on('get-user-stats', async (data: { address: string }) => {
      if (!rateLimiter.isGeneralAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      try {
        const user = await UserRepository.findByAddress(data.address);
        if (!user) {
          socket.emit('user-stats', { error: 'User not found' });
          return;
        }

        const history = await HandRepository.getHandHistory(user.id, 20);
        socket.emit('user-stats', {
          address: user.address,
          name: user.name,
          handsPlayed: user.handsPlayed,
          handsWon: user.handsWon,
          winRate: user.handsPlayed > 0 ? (user.handsWon / user.handsPlayed * 100).toFixed(1) : '0',
          totalWinnings: user.totalWinnings,
          totalLosses: user.totalLosses,
          netProfit: user.totalWinnings - user.totalLosses,
          recentHands: history,
        });
      } catch (error) {
        console.error('Error fetching user stats:', error);
        socket.emit('user-stats', { error: 'Failed to fetch stats' });
      }
    });

    // Create table
    socket.on('create-table', async (data: unknown) => {
      if (!rateLimiter.isGeneralAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      const validation = validateCreateTableData(data);
      if (!validation.valid) {
        socket.emit('error', { code: 'INVALID_DATA', message: validation.error });
        return;
      }

      const table = await tableManager.createTable(validation.data!, validation.data!.creatorAddress);
      io.emit('table-created', sanitizeTableForPlayer(table));
      io.emit('tables-list', tableManager.getAllTables());
    });

    // Delete table
    socket.on('delete-table', async (data: { tableId: string; address: string }) => {
      if (!rateLimiter.isGeneralAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      try {
        const table = tableManager.getTable(data.tableId);
        if (!table) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Table not found' });
          return;
        }

        // Check if user is the creator
        const user = await UserRepository.findByAddress(data.address);
        if (!user || table.createdBy !== user.id) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only the creator can delete this table' });
          return;
        }

        // Check if game is in progress
        if (table.currentHand) {
          socket.emit('error', { code: 'GAME_IN_PROGRESS', message: 'Cannot delete table while a game is in progress' });
          return;
        }

        // Remove the table
        await tableManager.removeTable(data.tableId);
        
        // Notify all clients
        io.emit('table-deleted', { tableId: data.tableId });
        io.emit('tables-list', tableManager.getAllTables());
      } catch (error) {
        console.error('Error deleting table:', error);
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Failed to delete table' });
      }
    });

    // Start game manually
    socket.on('start-game', async (data: { tableId: string; address: string }) => {
      if (!rateLimiter.isActionAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      try {
        const table = tableManager.getTable(data.tableId);
        if (!table) return;

        // Check if user is the creator
        const user = await UserRepository.findByAddress(data.address);
        if (!user || table.createdBy !== user.id) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only the creator can start the game' });
          return;
        }

        if (table.currentHand) return;

        // Check if enough players
        const playersWithChips = table.players.filter((p) => p !== null && p.stack > 0 && p.isConnected);
        if (playersWithChips.length < 2) {
          socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 players to start' });
          return;
        }

        startNewHand(io, tableManager, data.tableId);
      } catch (error) {
        console.error('Error starting game:', error);
      }
    });

    // Join table
    socket.on('join-table', async (data: unknown) => {
      // Security: Check if client is blocked due to violations
      if (violationLimiter.isBlocked(socket.id)) {
        socket.emit('error', { code: 'BLOCKED', message: 'Too many violations. Please wait.' });
        return;
      }

      if (!rateLimiter.isActionAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      const validation = validateJoinTableData(data);
      if (!validation.valid) {
        // Record violation for invalid data
        violationLimiter.recordViolation(socket.id);
        socket.emit('error', { code: 'INVALID_DATA', message: validation.error });
        return;
      }

      const joinData = validation.data!;

      // Security: Check if address is already at another table (prevent multi-tabling abuse)
      const existingTables = addressTableMap.get(joinData.address);
      if (existingTables && existingTables.size > 0) {
        // Allow same table rejoin, but not multiple tables
        if (!existingTables.has(joinData.tableId)) {
          socket.emit('error', { code: 'MULTI_TABLE', message: 'Already playing at another table' });
          return;
        }
      }

      // Escrow verification (if escrow is enabled and session ID provided)
      if (joinData.escrowSessionId) {
        const escrowSession = await getSession(joinData.escrowSessionId);
        
        if (!escrowSession) {
          socket.emit('error', { code: 'ESCROW_ERROR', message: 'Escrow session not found' });
          return;
        }

        if (escrowSession.status !== 'CONFIRMED') {
          socket.emit('error', { code: 'ESCROW_ERROR', message: `Invalid escrow status: ${escrowSession.status}` });
          return;
        }

        if (escrowSession.playerAddress !== joinData.address) {
          socket.emit('error', { code: 'ESCROW_ERROR', message: 'Escrow session address mismatch' });
          return;
        }

        if (escrowSession.tableId !== joinData.tableId) {
          socket.emit('error', { code: 'ESCROW_ERROR', message: 'Escrow session table mismatch' });
          return;
        }

        if (escrowSession.seatIndex !== joinData.seatIndex) {
          socket.emit('error', { code: 'ESCROW_ERROR', message: 'Escrow session seat mismatch' });
          return;
        }

        if (escrowSession.buyInAmount !== joinData.buyIn) {
          socket.emit('error', { code: 'ESCROW_ERROR', message: 'Escrow session amount mismatch' });
          return;
        }

        // Mark escrow session as playing
        await startPlaying(joinData.escrowSessionId);
        console.log(`[Escrow] Session ${joinData.escrowSessionId} started playing`);
      }

      const result = await tableManager.joinTable(joinData, socket.id);

      if (!result.success) {
        socket.emit('error', { code: 'JOIN_FAILED', message: result.error });
        return;
      }

      // Track address -> table mapping
      if (!addressTableMap.has(joinData.address)) {
        addressTableMap.set(joinData.address, new Set());
      }
      addressTableMap.get(joinData.address)!.add(joinData.tableId);

      const table = tableManager.getTable(joinData.tableId);
      if (!table) return;

      // Join socket room for this table
      socket.join(joinData.tableId);

      // Notify all players at table about new player
      io.to(joinData.tableId).emit('player-joined', {
        player: { ...result.player!, holeCards: null },
        seatIndex: joinData.seatIndex,
      });

      // Send updated table state to ALL players
      broadcastTableState(io, table);

      // Update lobby table list for all clients
      io.emit('tables-list', tableManager.getAllTables());

      // Check if we can start a hand (with lock to prevent race)
      const activePlayers = tableManager.getActivePlayers(joinData.tableId);
      if (activePlayers.length >= 2 && !table.currentHand) {
        // Auto-start ONLY if no creator is assigned to the table
        // If there is a creator, they must start manually
        if (!table.createdBy) {
          startNewHand(io, tableManager, joinData.tableId);
        } else {
          console.log(`[Game] Table ${joinData.tableId} has creator ${table.createdBy}, waiting for manual start.`);
        }
      }
    });

    // Leave table
    socket.on('leave-table', async (data: unknown) => {
      if (!rateLimiter.isActionAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      const validation = validateLeaveTableData(data);
      if (!validation.valid) {
        socket.emit('error', { code: 'INVALID_DATA', message: validation.error });
        return;
      }

      const { tableId } = validation.data!;
      const playerInfo = tableManager.getPlayerBySocketId(socket.id);

      if (!playerInfo || playerInfo.tableId !== tableId) {
        socket.emit('error', { code: 'NOT_AT_TABLE', message: 'Not at this table' });
        return;
      }

      const result = await tableManager.leaveTable(tableId, playerInfo.player.id);
      if (result.success) {
        // Cleanup address -> table mapping
        const playerAddress = playerInfo.player.address;
        const tables = addressTableMap.get(playerAddress);
        if (tables) {
          tables.delete(tableId);
          if (tables.size === 0) {
            addressTableMap.delete(playerAddress);
          }
        }

        // Clear action timing for this player
        actionValidator.clear(playerInfo.player.id);

        socket.leave(tableId);
        io.to(tableId).emit('player-left', {
          playerId: playerInfo.player.id,
          seatIndex: playerInfo.player.seatIndex,
        });

        // Send updated table state to remaining players
        const table = tableManager.getTable(tableId);
        if (table) {
          broadcastTableState(io, table);
        }

        io.emit('tables-list', tableManager.getAllTables());
      }
    });

    // Rejoin table after reconnect
    socket.on('rejoin-table', (data: unknown) => {
      if (!rateLimiter.isActionAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      const validation = validateRejoinData(data);
      if (!validation.valid) {
        socket.emit('rejoin-failed', { message: validation.error });
        return;
      }

      const { tableId, address } = validation.data!;
      const table = tableManager.getTable(tableId);

      if (!table) {
        socket.emit('rejoin-failed', { message: 'Table not found' });
        return;
      }

      // Find player by address
      const player = table.players.find((p) => p?.address === address);
      if (!player) {
        socket.emit('rejoin-failed', { message: 'Not seated at this table' });
        return;
      }

      // Update player's socket and connection status
      player.socketId = socket.id;
      player.isConnected = true;
      // Only set to active if not folded or all-in
      if (player.status === 'sitting-out') {
        player.status = 'active';
      }

      // Join socket room
      socket.join(tableId);

      console.log(`[Socket] Player ${player.name} rejoined table ${table.name}`);

      // Send table state with player's hole cards
      socket.emit('rejoin-success', {
        table: sanitizeTableForPlayer(table, player.id),
        yourCards: player.holeCards,
      });

      // Notify other players
      io.to(tableId).emit('player-reconnected', {
        playerId: player.id,
        seatIndex: player.seatIndex,
      });

      // Send updated table state to all other players
      for (const p of table.players) {
        if (p && p.isConnected && p.id !== player.id) {
          io.to(p.socketId).emit('table-state', sanitizeTableForPlayer(table, p.id));
        }
      }
    });

    // Player action
    socket.on('player-action', (data: unknown) => {
      // Security: Check if client is blocked
      if (violationLimiter.isBlocked(socket.id)) {
        socket.emit('error', { code: 'BLOCKED', message: 'Too many violations. Please wait.' });
        return;
      }

      if (!rateLimiter.isActionAllowed(socket.id, clientIP)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      const validation = validatePlayerActionData(data);
      if (!validation.valid) {
        violationLimiter.recordViolation(socket.id);
        socket.emit('error', { code: 'INVALID_DATA', message: validation.error });
        return;
      }

      const actionData = validation.data!;
      const playerInfo = tableManager.getPlayerBySocketId(socket.id);

      if (!playerInfo || playerInfo.tableId !== actionData.tableId) {
        violationLimiter.recordViolation(socket.id);
        socket.emit('error', { code: 'NOT_AT_TABLE', message: 'Not at this table' });
        return;
      }

      // Security: Bot detection - check action timing
      if (!actionValidator.validateTiming(playerInfo.player.id)) {
        console.log(`[Security] Suspicious fast action from player ${playerInfo.player.id}`);
        // Don't block, just log for now - could be legitimate fast player
      }

      const table = tableManager.getTable(actionData.tableId);
      if (!table || !table.currentHand) {
        socket.emit('error', { code: 'NO_HAND', message: 'No active hand' });
        return;
      }

      // Acquire lock to prevent race conditions
      if (!acquireHandLock(actionData.tableId)) {
        socket.emit('error', { code: 'BUSY', message: 'Processing another action' });
        return;
      }

      try {
        const gameManager = getGameManager(actionData.tableId);
        const result = gameManager.processAction(
          table,
          playerInfo.player.id,
          actionData.action,
          actionData.amount
        );

        if (!result.success) {
          socket.emit('error', { code: 'INVALID_ACTION', message: result.error });
          return;
        }

        // Clear turn timer
        gameManager.clearTurnTimeout();

        // Broadcast action to all players
        io.to(actionData.tableId).emit('player-acted', {
          playerId: playerInfo.player.id,
          action: table.currentHand.actions[table.currentHand.actions.length - 1],
        });

        // Check if hand is over
        const activePlayers = table.players.filter(
          (p) => p !== null && p.status !== 'folded' && p.status !== 'sitting-out'
        );

        if (activePlayers.length === 1) {
          // Single winner - award pot
          const winner = activePlayers[0]!;
          const potAmount = table.currentHand.pot;
          const communityCards = table.currentHand.communityCards.map((c) => `${c.rank}${c.suit}`);
          const dealerSeat = table.currentHand.dealerIndex;

          winner.stack += potAmount;

          const handResult: HandResult = {
            winners: [
              {
                playerId: winner.id,
                amount: potAmount,
                hand: { rank: 'high-card', rankValue: 1, name: 'Winner by fold', cards: [], score: 0 },
              },
            ],
            showdown: [],
          };

          io.to(actionData.tableId).emit('hand-ended', { result: handResult });

          // Save hand history
          const startingStacks = handStartingStacks.get(actionData.tableId);
          if (startingStacks) {
            settleGameWallets(tableManager, table, handResult, startingStacks).catch(console.error);
            saveHandHistory(
              actionData.tableId,
              table,
              handResult,
              communityCards,
              potAmount,
              dealerSeat,
              (dealerSeat + 1) % table.maxPlayers,
              (dealerSeat + 2) % table.maxPlayers,
              startingStacks
            ).catch(console.error);
          }

          // Clear hand
          table.currentHand = null;

          // Start new hand after delay
          setTimeout(() => startNewHand(io, tableManager, actionData.tableId), 3000);
          return;
        }

        if (table.currentHand.stage === 'showdown') {
          // Evaluate showdown
          const communityCards = table.currentHand.communityCards.map((c) => `${c.rank}${c.suit}`);
          const potAmount = table.currentHand.pot;
          const dealerSeat = table.currentHand.dealerIndex;

          const handResult = gameManager.evaluateShowdown(table);
          if (handResult) {
            io.to(actionData.tableId).emit('hand-ended', { result: handResult });

            // Save hand history
            const startingStacks = handStartingStacks.get(actionData.tableId);
            if (startingStacks) {
              settleGameWallets(tableManager, table, handResult, startingStacks).catch(console.error);
              saveHandHistory(
                actionData.tableId,
                table,
                handResult,
                communityCards,
                potAmount,
                dealerSeat,
                (dealerSeat + 1) % table.maxPlayers,
                (dealerSeat + 2) % table.maxPlayers,
                startingStacks
              ).catch(console.error);
            }

            // Clear hand
            table.currentHand = null;

            // Start new hand after delay
            setTimeout(() => startNewHand(io, tableManager, actionData.tableId), 5000);
          }
          return;
        }

        // Send updated table state
        broadcastTableState(io, table);

        // Notify next player and start turn timer
        const nextPlayer = table.players[table.currentHand.activePlayerIndex];
        if (nextPlayer && nextPlayer.status === 'active') {
          io.to(actionData.tableId).emit('turn-changed', {
            playerId: nextPlayer.id,
            timeRemaining: TURN_TIMEOUT_MS / 1000,
          });

          // Set turn timeout
          setTurnTimeout(io, tableManager, actionData.tableId, nextPlayer.id);
        }
      } finally {
        releaseHandLock(actionData.tableId);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Clean up rate limiter
      // Cleanup IP connection tracking
      const disconnectedIP = socketIPMap.get(socket.id);
      if (disconnectedIP) {
        rateLimiter.unregisterConnection(disconnectedIP, socket.id);
        socketIPMap.delete(socket.id);
      }

      rateLimiter.remove(socket.id);

      const playerInfo = tableManager.getPlayerBySocketId(socket.id);
      if (playerInfo) {
        // Mark player as disconnected but don't remove immediately
        tableManager.updatePlayerConnection(socket.id, false);

        io.to(playerInfo.tableId).emit('player-disconnected', {
          playerId: playerInfo.player.id,
          seatIndex: playerInfo.player.seatIndex,
        });

        // Send updated table state to remaining connected players
        const table = tableManager.getTable(playerInfo.tableId);
        if (table) {
          broadcastTableState(io, table);
        }

        // Store player info for grace period check
        const disconnectedPlayerId = playerInfo.player.id;
        const disconnectedTableId = playerInfo.tableId;

        // Grace period: remove player if not reconnected
        setTimeout(async () => {
          const table = tableManager.getTable(disconnectedTableId);
          if (!table) return;

          const player = table.players.find((p) => p?.id === disconnectedPlayerId);
          if (player && !player.isConnected) {
            await tableManager.leaveTable(disconnectedTableId, disconnectedPlayerId);
            io.to(disconnectedTableId).emit('player-left', {
              playerId: disconnectedPlayerId,
              seatIndex: player.seatIndex,
            });

            // Send updated table state to remaining players
            broadcastTableState(io, table);
            io.emit('tables-list', tableManager.getAllTables());
          }
        }, DISCONNECT_GRACE_MS);
      }
    });
  });
}

// Set turn timeout with proper cleanup
function setTurnTimeout(
  io: Server,
  tableManager: TableManager,
  tableId: string,
  playerId: string
): void {
  const gameManager = getGameManager(tableId);

  gameManager.setTurnTimeout(() => {
    // Acquire lock
    if (!acquireHandLock(tableId)) {
      // Another action is being processed, skip timeout
      return;
    }

    try {
      const table = tableManager.getTable(tableId);
      if (!table?.currentHand) return;

      const currentActivePlayer = table.players[table.currentHand.activePlayerIndex];
      if (!currentActivePlayer || currentActivePlayer.id !== playerId) return;

      // Auto-fold on timeout
      const foldResult = gameManager.processAction(table, playerId, 'fold');
      if (!foldResult.success) return;

      io.to(tableId).emit('player-acted', {
        playerId,
        action: { playerId, type: 'fold', timestamp: Date.now() },
      });

      // Check if hand ended after auto-fold
      const remainingPlayers = table.players.filter(
        (p) => p !== null && p.status !== 'folded' && p.status !== 'sitting-out'
      );

      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0]!;
        const potAmount = table.currentHand!.pot;
        const communityCards = table.currentHand!.communityCards.map((c) => `${c.rank}${c.suit}`);
        const dealerSeat = table.currentHand!.dealerIndex;

        winner.stack += potAmount;

        const handResult: HandResult = {
          winners: [
            {
              playerId: winner.id,
              amount: potAmount,
              hand: { rank: 'high-card', rankValue: 1, name: 'Winner by fold', cards: [], score: 0 },
            },
          ],
          showdown: [],
        };

        io.to(tableId).emit('hand-ended', { result: handResult });

        // Save hand history
        const startingStacks = handStartingStacks.get(tableId);
        if (startingStacks) {
          settleGameWallets(tableManager, table, handResult, startingStacks).catch(console.error);
          saveHandHistory(
            tableId,
            table,
            handResult,
            communityCards,
            potAmount,
            dealerSeat,
            (dealerSeat + 1) % table.maxPlayers,
            (dealerSeat + 2) % table.maxPlayers,
            startingStacks
          ).catch(console.error);
        }

        table.currentHand = null;
        setTimeout(() => startNewHand(io, tableManager, tableId), 3000);
      } else if (table.currentHand) {
        // Send updated state
        broadcastTableState(io, table);

        // Set next turn timer
        const nextActivePlayer = table.players[table.currentHand.activePlayerIndex];
        if (nextActivePlayer && nextActivePlayer.status === 'active') {
          io.to(tableId).emit('turn-changed', {
            playerId: nextActivePlayer.id,
            timeRemaining: TURN_TIMEOUT_MS / 1000,
          });

          // Recursive timeout for next player
          setTurnTimeout(io, tableManager, tableId, nextActivePlayer.id);
        }
      }
    } finally {
      releaseHandLock(tableId);
    }
  }, TURN_TIMEOUT_MS);
}

// Track starting stacks for hand history
const handStartingStacks: Map<string, Map<string, number>> = new Map();

function startNewHand(io: Server, tableManager: TableManager, tableId: string): void {
  // Acquire lock to prevent multiple startNewHand calls
  if (!acquireHandLock(tableId)) {
    return;
  }

  try {
    const table = tableManager.getTable(tableId);
    if (!table) return;

    // Don't start if hand already exists
    if (table.currentHand) return;

    // Kick busted players (stack <= 0) from the table
    const bustedPlayers: Player[] = [];
    for (let i = 0; i < table.players.length; i++) {
      const player = table.players[i];
      if (player && player.stack <= 0) {
        console.log(
          `[Game] Player ${player.name} is busted (stack: ${player.stack}), kicking from table`
        );
        bustedPlayers.push(player);
        const gameWalletSessionId = tableManager.getGameWalletSessionId(player.id);
        if (gameWalletSessionId) {
          completeSession(gameWalletSessionId, player.stack).catch(console.error);
        }

        // Emit busted event to the player
        io.to(player.socketId).emit('player-busted', {
          playerId: player.id,
          message: 'You ran out of chips! Buy in again to continue playing.',
        });

        // Emit player left to others
        io.to(tableId).emit('player-left', {
          playerId: player.id,
          seatIndex: player.seatIndex,
        });

        // NOTE: We don't set table.players[i] = null here anymore.
        // tableManager.leaveTable will handle memory cleanup and DB session termination.
      }
    }

    // Leave table for busted players (async, don't await)
    for (const player of bustedPlayers) {
      tableManager.leaveTable(tableId, player.id).catch(err => {
        console.error(`[Game] Failed to process leaveTable for busted player ${player.id}:`, err);
      });
    }

    // Get players with chips who can play
    const playersWithChips = table.players.filter((p) => p !== null && p.stack > 0 && p.isConnected);

    // Need at least 2 players with chips to start
    if (playersWithChips.length < 2) {
      console.log(`[Game] Not enough players with chips (${playersWithChips.length}), waiting...`);
      io.to(tableId).emit('waiting-for-players', {
        message: 'Waiting for more players with chips to join...',
        currentPlayers: playersWithChips.length,
        required: 2,
      });

      // Broadcast updated table state
      broadcastTableState(io, table);
      io.emit('tables-list', tableManager.getAllTables());
      return;
    }

    // Store starting stacks for hand history
    const startingStacks = new Map<string, number>();
    for (const player of table.players) {
      if (player) {
        startingStacks.set(player.id, player.stack);
      }
    }
    handStartingStacks.set(tableId, startingStacks);

    const gameManager = getGameManager(tableId);

    // Clear any existing timeout before starting new hand
    gameManager.clearTurnTimeout();

    const hand = gameManager.startHand(table);

    if (!hand) {
      console.log(`[Game] Failed to start hand - not enough active players`);
      return;
    }

    console.log(`[Game] New hand started: ${hand.id}, stage: ${hand.stage}`);

    // Send hand started to each player with their hole cards
    for (const player of table.players) {
      if (player && player.isConnected) {
        io.to(player.socketId).emit('hand-started', {
          hand: { ...hand, communityCards: [] },
          yourCards: player.holeCards,
        });
      }
    }

    // Broadcast updated table state
    broadcastTableState(io, table);

    // Notify first player to act
    const firstPlayer = table.players[hand.activePlayerIndex];
    if (firstPlayer && firstPlayer.status === 'active') {
      io.to(tableId).emit('turn-changed', {
        playerId: firstPlayer.id,
        timeRemaining: TURN_TIMEOUT_MS / 1000,
      });

      // Set turn timeout for first player (after releasing lock)
      setTimeout(() => {
        setTurnTimeout(io, tableManager, tableId, firstPlayer.id);
      }, 0);
    }
  } finally {
    releaseHandLock(tableId);
  }
}
