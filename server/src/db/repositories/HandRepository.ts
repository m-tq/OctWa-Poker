import { eq, desc, inArray } from 'drizzle-orm';
import {
  db,
  hands,
  handPlayers,
  actions,
  type Hand,
  type HandPlayer,
  type Action,
} from '../index.js';
import { v4 as uuid } from 'uuid';

export interface CreateHandData {
  tableId: string;
  handNumber: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
}

export interface HandPlayerData {
  handId: string;
  userId: string;
  seatIndex: number;
  holeCards: string[] | null;
  startingStack: number;
  endingStack: number;
  totalBet: number;
  won: number;
  finalHand: object | null;
  result: 'won' | 'lost' | 'folded' | 'split';
}

export interface ActionData {
  handId: string;
  userId: string;
  stage: 'preflop' | 'flop' | 'turn' | 'river';
  actionType: string;
  amount?: number;
  potAfter: number;
  sequenceNum: number;
}

export class HandRepository {
  static async create(data: CreateHandData): Promise<Hand> {
    const id = uuid();
    await db.insert(hands).values({
      id,
      tableId: data.tableId,
      handNumber: data.handNumber,
      dealerSeat: data.dealerSeat,
      smallBlindSeat: data.smallBlindSeat,
      bigBlindSeat: data.bigBlindSeat,
      communityCards: '[]',
      pot: 0,
    });
    
    const result = await db.select().from(hands).where(eq(hands.id, id)).limit(1);
    return result[0];
  }

  static async findById(id: string): Promise<Hand | undefined> {
    const result = await db.select().from(hands).where(eq(hands.id, id)).limit(1);
    return result[0];
  }

  static async complete(
    handId: string, 
    data: { 
      communityCards: string[]; 
      pot: number; 
      winnersJson: object[];
      rake?: number;
    }
  ): Promise<void> {
    await db.update(hands)
      .set({
        communityCards: JSON.stringify(data.communityCards),
        pot: data.pot,
        winnersJson: JSON.stringify(data.winnersJson),
        rake: data.rake || 0,
        endedAt: new Date(),
      })
      .where(eq(hands.id, handId));
  }

  static async addPlayer(data: HandPlayerData): Promise<void> {
    await db.insert(handPlayers).values({
      id: uuid(),
      handId: data.handId,
      userId: data.userId,
      seatIndex: data.seatIndex,
      holeCards: data.holeCards ? JSON.stringify(data.holeCards) : null,
      startingStack: data.startingStack,
      endingStack: data.endingStack,
      totalBet: data.totalBet,
      won: data.won,
      finalHand: data.finalHand ? JSON.stringify(data.finalHand) : null,
      result: data.result,
    });
  }

  static async addAction(data: ActionData): Promise<void> {
    await db.insert(actions).values({
      id: uuid(),
      handId: data.handId,
      userId: data.userId,
      stage: data.stage,
      actionType: data.actionType,
      amount: data.amount,
      potAfter: data.potAfter,
      sequenceNum: data.sequenceNum,
    });
  }

  static async getHandHistory(userId: string, limit: number = 50): Promise<Hand[]> {
    // Get hands where user participated
    const playerHands = await db
      .select({ handId: handPlayers.handId })
      .from(handPlayers)
      .where(eq(handPlayers.userId, userId));

    const handIds = playerHands.map((h: { handId: string }) => h.handId);
    if (handIds.length === 0) return [];

    // Get all hands for this user using inArray
    return db
      .select()
      .from(hands)
      .where(inArray(hands.id, handIds))
      .orderBy(desc(hands.startedAt))
      .limit(limit);
  }

  static async getHandDetails(handId: string): Promise<{
    hand: Hand;
    players: HandPlayer[];
    actions: Action[];
  } | null> {
    const hand = await this.findById(handId);
    if (!hand) return null;

    const players = await db.select()
      .from(handPlayers)
      .where(eq(handPlayers.handId, handId));

    const handActions = await db.select()
      .from(actions)
      .where(eq(actions.handId, handId))
      .orderBy(actions.sequenceNum);

    return { hand, players, actions: handActions };
  }

  static async getTableHandCount(tableId: string): Promise<number> {
    const result = await db.select()
      .from(hands)
      .where(eq(hands.tableId, tableId));
    return result.length;
  }
}
