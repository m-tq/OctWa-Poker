import { eq } from 'drizzle-orm';
import { db, users, type User, type NewUser } from '../index.js';
import { v4 as uuid } from 'uuid';

export class UserRepository {
  static async findById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  static async findByAddress(address: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.address, address)).limit(1);
    return result[0];
  }

  static async findOrCreate(address: string, name: string): Promise<User> {
    let user = await this.findByAddress(address);
    
    if (!user) {
      const newUser: NewUser = {
        id: uuid(),
        address,
        name,
      };
      await db.insert(users).values(newUser);
      user = await this.findById(newUser.id);
    } else {
      // Update last seen
      await db.update(users)
        .set({ lastSeen: new Date() })
        .where(eq(users.id, user.id));
    }
    
    return user!;
  }

  static async updateStats(
    userId: string, 
    stats: { 
      handsPlayed?: number; 
      handsWon?: number; 
      totalWinnings?: number; 
      totalLosses?: number;
    }
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;

    await db.update(users)
      .set({
        handsPlayed: user.handsPlayed + (stats.handsPlayed || 0),
        handsWon: user.handsWon + (stats.handsWon || 0),
        totalWinnings: user.totalWinnings + (stats.totalWinnings || 0),
        totalLosses: user.totalLosses + (stats.totalLosses || 0),
      })
      .where(eq(users.id, userId));
  }

  static async updateName(userId: string, name: string): Promise<void> {
    await db.update(users)
      .set({ name })
      .where(eq(users.id, userId));
  }

  static async getLeaderboard(limit: number = 10): Promise<User[]> {
    // Get all users and sort by net profit (totalWinnings - totalLosses)
    const allUsers = await db.select().from(users);
    return allUsers
      .map((u) => ({
        ...u,
        netProfit: u.totalWinnings - u.totalLosses,
      }))
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);
  }
}
