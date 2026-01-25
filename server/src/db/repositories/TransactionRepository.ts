import { eq, and, desc } from 'drizzle-orm';
import { db, transactions, type Transaction } from '../index.js';
import { v4 as uuid } from 'uuid';

export interface CreateTransactionData {
  userId: string;
  tableId?: string;
  type: 'buy_in' | 'cash_out' | 'add_on';
  amount: number;
  txHash?: string;
}

export class TransactionRepository {
  static async create(data: CreateTransactionData): Promise<Transaction> {
    const id = uuid();
    await db.insert(transactions).values({
      id,
      userId: data.userId,
      tableId: data.tableId,
      type: data.type,
      amount: data.amount,
      txHash: data.txHash,
      status: data.txHash ? 'pending' : 'confirmed', // If no txHash, it's internal
    });
    
    const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return result[0];
  }

  static async findById(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return result[0];
  }

  static async findByTxHash(txHash: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.txHash, txHash)).limit(1);
    return result[0];
  }

  static async confirm(id: string): Promise<void> {
    await db.update(transactions)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
      })
      .where(eq(transactions.id, id));
  }

  static async fail(id: string): Promise<void> {
    await db.update(transactions)
      .set({ status: 'failed' })
      .where(eq(transactions.id, id));
  }

  static async getUserTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
    return db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  static async getTableTransactions(tableId: string): Promise<Transaction[]> {
    return db.select()
      .from(transactions)
      .where(eq(transactions.tableId, tableId))
      .orderBy(desc(transactions.createdAt));
  }

  static async getPendingTransactions(): Promise<Transaction[]> {
    return db.select()
      .from(transactions)
      .where(eq(transactions.status, 'pending'));
  }
}
