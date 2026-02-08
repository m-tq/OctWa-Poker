import { v4 as uuidv4 } from "uuid";
import type {
  Table,
  Player,
  CreateTableData,
  JoinTableData,
} from "../types/index.js";
import {
  UserRepository,
  TableRepository,
  TransactionRepository,
} from "../db/repositories/index.js";
import { completeSession } from "../gameWallet/index.js";

export class TableManager {
  private tables: Map<string, Table> = new Map();
  private playerSessions: Map<
    string,
    { socketId: string; tableId: string | null }
  > = new Map();
  // Map playerId to database userId
  private playerUserMap: Map<string, string> = new Map();
  private playerGameWalletSessions: Map<string, string> = new Map();

  async initialize(): Promise<void> {
    // Load active tables from database on startup
    const dbTables = await TableRepository.findActive();
    for (const dbTable of dbTables) {
      const table: Table = {
        id: dbTable.id,
        name: dbTable.name,
        smallBlind: dbTable.smallBlind,
        bigBlind: dbTable.bigBlind,
        minBuyIn: dbTable.minBuyIn,
        maxBuyIn: dbTable.maxBuyIn,
        maxPlayers: dbTable.maxPlayers,
        players: new Array(dbTable.maxPlayers).fill(null),
        currentHand: null,
        createdBy: dbTable.createdBy || undefined,
        mode: "cash",
        waitlist: [],
        handCount: 0,
      };

      if (dbTable.createdBy) {
        const creator = await UserRepository.findById(dbTable.createdBy);
        if (creator) {
          table.creatorAddress = creator.address;
        }
      }

      // Load active sessions for this table
      const sessions = await TableRepository.getActiveSessions(dbTable.id);
      for (const session of sessions) {
        const user = await UserRepository.findById(session.userId);
        if (user) {
          const player: Player = {
            id: uuidv4(),
            address: user.address,
            name: user.name,
            stack: session.currentStack,
            holeCards: null,
            bet: 0,
            status: "sitting-out", // Mark as sitting out until they reconnect
            seatIndex: session.seatIndex,
            isConnected: false,
            socketId: "",
            lastActionAt: Date.now(),
            joinedAt: Date.now(),
          };
          table.players[session.seatIndex] = player;
          this.playerUserMap.set(player.id, user.id);
        }
      }

      this.tables.set(table.id, table);
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[TableManager] Loaded ${this.tables.size} tables from database`,
      );
    }
  }

  async createTable(
    data: CreateTableData,
    creatorAddress?: string,
  ): Promise<Table> {
    // Get or create user if creator address provided
    let createdBy: string | undefined;
    if (creatorAddress) {
      const user = await UserRepository.findOrCreate(
        creatorAddress,
        `Player ${creatorAddress.slice(0, 6)}`,
      );
      createdBy = user.id;
    }

    // Save to database
    const dbTable = await TableRepository.create({
      name: data.name,
      smallBlind: data.smallBlind,
      bigBlind: data.bigBlind,
      minBuyIn: data.minBuyIn,
      maxBuyIn: data.maxBuyIn,
      maxPlayers: data.maxPlayers,
      createdBy,
    });

    const table: Table = {
      id: dbTable.id,
      name: data.name,
      smallBlind: data.smallBlind,
      bigBlind: data.bigBlind,
      minBuyIn: data.minBuyIn,
      maxBuyIn: data.maxBuyIn,
      maxPlayers: data.maxPlayers,
      players: new Array(data.maxPlayers).fill(null),
      currentHand: null,
      createdBy,
      creatorAddress,
      mode: "cash",
      waitlist: [],
      handCount: 0,
    };

    this.tables.set(table.id, table);
    return table;
  }

  getTable(tableId: string): Table | undefined {
    return this.tables.get(tableId);
  }

  getAllTables(): Table[] {
    return Array.from(this.tables.values()).map((table) => ({
      ...table,
      // Hide hole cards in public table list
      players: table.players.map((p) => (p ? { ...p, holeCards: null } : null)),
    }));
  }

  getTableCount(): number {
    return this.tables.size;
  }

  async removeTable(tableId: string): Promise<boolean> {
    await TableRepository.deactivate(tableId);
    return this.tables.delete(tableId);
  }

  async joinTable(
    data: JoinTableData,
    socketId: string,
  ): Promise<{ success: boolean; error?: string; player?: Player }> {
    const table = this.tables.get(data.tableId);
    if (!table) {
      return { success: false, error: "Table not found" };
    }

    if (data.seatIndex < 0 || data.seatIndex >= table.maxPlayers) {
      return { success: false, error: "Invalid seat index" };
    }

    if (table.players[data.seatIndex] !== null) {
      return { success: false, error: "Seat is taken" };
    }

    if (data.buyIn < table.minBuyIn || data.buyIn > table.maxBuyIn) {
      return {
        success: false,
        error: `Buy-in must be between ${table.minBuyIn} and ${table.maxBuyIn}`,
      };
    }

    // Check if player is already at this table
    const existingPlayer = table.players.find(
      (p) => p?.address === data.address,
    );
    if (existingPlayer) {
      return { success: false, error: "Already seated at this table" };
    }

    // Get or create user in database
    const user = await UserRepository.findOrCreate(data.address, data.name);

    // Create table session in database
    const session = await TableRepository.createSession({
      tableId: data.tableId,
      userId: user.id,
      seatIndex: data.seatIndex,
      buyIn: data.buyIn,
    });

    // Record buy-in transaction
    await TransactionRepository.create({
      userId: user.id,
      tableId: data.tableId,
      type: "buy_in",
      amount: data.buyIn,
    });

    const player: Player = {
      id: uuidv4(),
      address: data.address,
      name: data.name,
      stack: data.buyIn,
      holeCards: null,
      bet: 0,
      status: "active",
      seatIndex: data.seatIndex,
      isConnected: true,
      socketId,
      lastActionAt: Date.now(),
      joinedAt: Date.now(),
    };

    table.players[data.seatIndex] = player;
    this.playerSessions.set(player.id, { socketId, tableId: data.tableId });
    this.playerUserMap.set(player.id, user.id);
    if (data.escrowSessionId) {
      this.playerGameWalletSessions.set(player.id, data.escrowSessionId);
    }

    return { success: true, player };
  }

  async leaveTable(
    tableId: string,
    playerId: string,
  ): Promise<{ success: boolean; stack?: number }> {
    const table = this.tables.get(tableId);
    if (!table) {
      return { success: false };
    }

    const playerIndex = table.players.findIndex((p) => p?.id === playerId);
    if (playerIndex === -1) {
      return { success: false };
    }

    const player = table.players[playerIndex]!;
    const stack = player.stack;
    const userId = this.playerUserMap.get(playerId);
    const gameWalletSessionId = this.playerGameWalletSessions.get(playerId);

    try {
      // Update database
      if (userId) {
        const session = await TableRepository.getActiveSession(tableId, userId);
        if (session) {
          await TableRepository.endSession(session.id, stack);
        }

        // Record cash-out transaction
        await TransactionRepository.create({
          userId,
          tableId,
          type: "cash_out",
          amount: stack,
        });
      }

      if (gameWalletSessionId) {
        await completeSession(gameWalletSessionId, stack);
      }
    } catch (error) {
      console.error(
        `[TableManager] Error during leaveTable DB updates for player ${playerId}:`,
        error,
      );
      // We continue to remove the player from memory even if DB updates fail
      // to prevent "stuck" seats.
    } finally {
      // Always remove from memory to prevent stuck seats
      table.players[playerIndex] = null;
      this.playerSessions.delete(playerId);
      this.playerUserMap.delete(playerId);
      this.playerGameWalletSessions.delete(playerId);
    }

    // NOTE: Don't remove table when empty - keep it available for others to join
    // Table will only be removed manually or after inactivity timeout

    return { success: true, stack };
  }

  getPlayerBySocketId(
    socketId: string,
  ): { player: Player; tableId: string } | null {
    for (const [tableId, table] of this.tables) {
      const player = table.players.find((p) => p?.socketId === socketId);
      if (player) {
        return { player, tableId };
      }
    }
    return null;
  }

  updatePlayerConnection(socketId: string, connected: boolean): void {
    for (const table of this.tables.values()) {
      const player = table.players.find((p) => p?.socketId === socketId);
      if (player) {
        player.isConnected = connected;
        break;
      }
    }
  }

  getActivePlayers(tableId: string): Player[] {
    const table = this.tables.get(tableId);
    if (!table) return [];
    return table.players.filter(
      (p): p is Player => p !== null && p.status !== "sitting-out",
    );
  }

  getAvailableSeats(tableId: string): number[] {
    const table = this.tables.get(tableId);
    if (!table) return [];
    return table.players
      .map((p, i) => (p === null ? i : -1))
      .filter((i) => i !== -1);
  }

  // Update player stack in database
  async updatePlayerStack(playerId: string, stack: number): Promise<void> {
    const userId = this.playerUserMap.get(playerId);
    if (!userId) return;

    // Find the player's table
    for (const [tableId, table] of this.tables) {
      const player = table.players.find((p) => p?.id === playerId);
      if (player) {
        player.stack = stack;
        const session = await TableRepository.getActiveSession(tableId, userId);
        if (session) {
          await TableRepository.updateSessionStack(session.id, stack);
        }
        break;
      }
    }
  }

  // Get user ID for a player
  getUserId(playerId: string): string | undefined {
    return this.playerUserMap.get(playerId);
  }

  getGameWalletSessionId(playerId: string): string | undefined {
    return this.playerGameWalletSessions.get(playerId);
  }
}
