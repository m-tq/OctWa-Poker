import type { SidePot, EvaluatedHand } from '@/types/game';

/**
 * Player contribution for pot calculation
 */
export interface PlayerContribution {
  playerId: string;
  amount: number;
  isAllIn: boolean;
  isFolded: boolean;
}

/**
 * Pot structure with main pot and side pots
 */
export interface PotStructure {
  mainPot: {
    amount: number;
    eligiblePlayerIds: string[];
  };
  sidePots: SidePot[];
  totalPot: number;
}

/**
 * Winner distribution result
 */
export interface WinnerDistribution {
  playerId: string;
  amount: number;
  potType: 'main' | 'side';
  potIndex?: number;
}

/**
 * Calculate main pot and side pots from player contributions
 * Side pots are created when players go all-in for different amounts
 */
export function calculatePots(contributions: PlayerContribution[]): PotStructure {
  // Filter out folded players for pot eligibility (but keep their contributions)
  const activeContributions = contributions.filter(c => !c.isFolded);
  const allContributions = [...contributions];
  
  // Get unique all-in amounts, sorted ascending
  const allInAmounts = [...new Set(
    activeContributions
      .filter(c => c.isAllIn)
      .map(c => c.amount)
  )].sort((a, b) => a - b);
  
  // If no all-ins, everything goes to main pot
  if (allInAmounts.length === 0) {
    const totalPot = allContributions.reduce((sum, c) => sum + c.amount, 0);
    return {
      mainPot: {
        amount: totalPot,
        eligiblePlayerIds: activeContributions.map(c => c.playerId),
      },
      sidePots: [],
      totalPot,
    };
  }
  
  const pots: SidePot[] = [];
  let previousLevel = 0;
  
  // Create pots for each all-in level
  for (const allInAmount of allInAmounts) {
    const levelContribution = allInAmount - previousLevel;
    
    // Players eligible for this pot level
    const eligiblePlayers = activeContributions
      .filter(c => c.amount >= allInAmount)
      .map(c => c.playerId);
    
    // Calculate pot amount at this level
    const potAmount = allContributions
      .filter(c => c.amount >= previousLevel)
      .reduce((sum, c) => {
        const contribution = Math.min(c.amount - previousLevel, levelContribution);
        return sum + Math.max(0, contribution);
      }, 0);
    
    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligiblePlayers,
      });
    }
    
    previousLevel = allInAmount;
  }
  
  // Create final pot for remaining contributions above highest all-in
  const maxAllIn = allInAmounts[allInAmounts.length - 1];
  const remainingPlayers = activeContributions
    .filter(c => c.amount > maxAllIn)
    .map(c => c.playerId);
  
  if (remainingPlayers.length > 0) {
    const remainingAmount = allContributions
      .filter(c => c.amount > maxAllIn)
      .reduce((sum, c) => sum + (c.amount - maxAllIn), 0);
    
    if (remainingAmount > 0) {
      pots.push({
        amount: remainingAmount,
        eligiblePlayerIds: remainingPlayers,
      });
    }
  }
  
  // First pot is main pot, rest are side pots
  const mainPot = pots[0] || { amount: 0, eligiblePlayerIds: [] };
  const sidePots = pots.slice(1);
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
  
  return {
    mainPot,
    sidePots,
    totalPot,
  };
}

/**
 * Player hand for distribution
 */
export interface PlayerHand {
  playerId: string;
  hand: EvaluatedHand;
}

/**
 * Distribute pot to winners
 * Handles ties by splitting equally (remainder to earliest position)
 */
export function distributePot(
  potStructure: PotStructure,
  playerHands: PlayerHand[],
  playerPositions: Map<string, number> // playerId -> seat position
): WinnerDistribution[] {
  const distributions: WinnerDistribution[] = [];
  
  // Helper to find winners for a pot
  const findPotWinners = (eligiblePlayerIds: string[]): string[] => {
    const eligibleHands = playerHands.filter(ph => 
      eligiblePlayerIds.includes(ph.playerId)
    );
    
    if (eligibleHands.length === 0) return [];
    if (eligibleHands.length === 1) return [eligibleHands[0].playerId];
    
    // Find best score
    const maxScore = Math.max(...eligibleHands.map(ph => ph.hand.score));
    
    // Get all players with best score
    return eligibleHands
      .filter(ph => ph.hand.score === maxScore)
      .map(ph => ph.playerId);
  };
  
  // Helper to split pot among winners
  const splitPot = (
    amount: number,
    winnerIds: string[],
    potType: 'main' | 'side',
    potIndex?: number
  ): WinnerDistribution[] => {
    if (winnerIds.length === 0) return [];
    if (winnerIds.length === 1) {
      return [{
        playerId: winnerIds[0],
        amount,
        potType,
        potIndex,
      }];
    }
    
    // Split equally, remainder to earliest position
    const baseAmount = Math.floor(amount / winnerIds.length);
    const remainder = amount % winnerIds.length;
    
    // Sort winners by position (earliest first)
    const sortedWinners = [...winnerIds].sort((a, b) => {
      const posA = playerPositions.get(a) ?? 999;
      const posB = playerPositions.get(b) ?? 999;
      return posA - posB;
    });
    
    return sortedWinners.map((playerId, index) => ({
      playerId,
      amount: baseAmount + (index < remainder ? 1 : 0),
      potType,
      potIndex,
    }));
  };
  
  // Distribute main pot
  const mainWinners = findPotWinners(potStructure.mainPot.eligiblePlayerIds);
  distributions.push(...splitPot(potStructure.mainPot.amount, mainWinners, 'main'));
  
  // Distribute side pots
  potStructure.sidePots.forEach((sidePot, index) => {
    const sideWinners = findPotWinners(sidePot.eligiblePlayerIds);
    distributions.push(...splitPot(sidePot.amount, sideWinners, 'side', index));
  });
  
  return distributions;
}

/**
 * Verify pot conservation (total distributed equals total pot)
 */
export function verifyPotConservation(
  potStructure: PotStructure,
  distributions: WinnerDistribution[]
): boolean {
  const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);
  return totalDistributed === potStructure.totalPot;
}

/**
 * PotCalculator class for convenience
 */
export class PotCalculator {
  /**
   * Calculate pot structure from contributions
   */
  static calculatePots(contributions: PlayerContribution[]): PotStructure {
    return calculatePots(contributions);
  }
  
  /**
   * Distribute pot to winners
   */
  static distributePot(
    potStructure: PotStructure,
    playerHands: PlayerHand[],
    playerPositions: Map<string, number>
  ): WinnerDistribution[] {
    return distributePot(potStructure, playerHands, playerPositions);
  }
  
  /**
   * Verify pot conservation
   */
  static verifyConservation(
    potStructure: PotStructure,
    distributions: WinnerDistribution[]
  ): boolean {
    return verifyPotConservation(potStructure, distributions);
  }
}
