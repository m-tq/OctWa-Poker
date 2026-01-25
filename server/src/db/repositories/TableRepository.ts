import { eq, and } from 'drizzle-orm';
import { db, tables, tableSessions, type Table, type NewTable, type TableSession } from '../index.js';
import { v4 as uuid } from 'uuid';

export class TableRepository {
  static async findById(id: string): Promise<Table | undefined> {
    const result = await db.select().from(tables).where(eq(tables.id, id)).limit(1);
    return result[0];
  }

  static async findActive(): Promise<Table[]> {
    return db.select().from(tables).where(eq(tables.isActive, true));
  }

  static async create(data: Omit<NewTable, 'id'>): Promise<Table> {
    const id = uuid();
    await db.insert(tables).values({ ...data, id });
    return (await this.findById(id))!;
  }

  static async deactivate(id: string): Promise<void> {
    await db.update(tables)
      .set({ isActive: false })
      .where(eq(tables.id, id));
  }

  // Session management
  static async createSession(data: {
    tableId: string;
    userId: string;
    seatIndex: number;
    buyIn: number;
  }): Promise<TableSession> {
    const id = uuid();
    await db.insert(tableSessions).values({
      id,
      tableId: data.tableId,
      userId: data.userId,
      seatIndex: data.seatIndex,
      buyIn: data.buyIn,
      currentStack: data.buyIn,
    });
    
    const result = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
    return result[0];
  }

  static async getActiveSession(tableId: string, userId: string): Promise<TableSession | undefined> {
    const result = await db.select()
      .from(tableSessions)
      .where(and(
        eq(tableSessions.tableId, tableId),
        eq(tableSessions.userId, userId),
        eq(tableSessions.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  static async getActiveSessions(tableId: string): Promise<TableSession[]> {
    return db.select()
      .from(tableSessions)
      .where(and(
        eq(tableSessions.tableId, tableId),
        eq(tableSessions.isActive, true)
      ));
  }

  static async updateSessionStack(sessionId: string, stack: number): Promise<void> {
    await db.update(tableSessions)
      .set({ currentStack: stack })
      .where(eq(tableSessions.id, sessionId));
  }

  static async endSession(sessionId: string, cashOut: number): Promise<void> {
    await db.update(tableSessions)
      .set({
        isActive: false,
        leftAt: new Date(),
        cashOut,
      })
      .where(eq(tableSessions.id, sessionId));
  }
}
