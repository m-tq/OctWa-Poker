import type { Card, EvaluatedHand, HandRank, Rank } from '@/types/game';
import { rankValue } from './Deck';

/**
 * Hand rank values for comparison (higher is better)
 */
const HAND_RANK_VALUES: Record<HandRank, number> = {
  'high-card': 1,
  'pair': 2,
  'two-pair': 3,
  'three-of-a-kind': 4,
  'straight': 5,
  'flush': 6,
  'full-house': 7,
  'four-of-a-kind': 8,
  'straight-flush': 9,
  'royal-flush': 10,
};

/**
 * Hand rank display names
 */
const HAND_RANK_NAMES: Record<HandRank, string> = {
  'high-card': 'High Card',
  'pair': 'Pair',
  'two-pair': 'Two Pair',
  'three-of-a-kind': 'Three of a Kind',
  'straight': 'Straight',
  'flush': 'Flush',
  'full-house': 'Full House',
  'four-of-a-kind': 'Four of a Kind',
  'straight-flush': 'Straight Flush',
  'royal-flush': 'Royal Flush',
};

/**
 * Generate all 5-card combinations from an array of cards
 */
function combinations(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  if (cards.length < size) return [];
  
  const result: Card[][] = [];
  
  function combine(start: number, current: Card[]) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    
    for (let i = start; i <= cards.length - (size - current.length); i++) {
      current.push(cards[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  
  combine(0, []);
  return result;
}

/**
 * Sort cards by rank value (descending)
 */
function sortByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
}

/**
 * Group cards by rank
 */
function groupByRank(cards: Card[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>();
  for (const card of cards) {
    const existing = groups.get(card.rank) || [];
    existing.push(card);
    groups.set(card.rank, existing);
  }
  return groups;
}

/**
 * Check if cards form a flush (all same suit)
 */
function isFlush(cards: Card[]): boolean {
  const suit = cards[0].suit;
  return cards.every(c => c.suit === suit);
}

/**
 * Check if cards form a straight
 * Returns the high card value if straight, 0 otherwise
 * Handles A-2-3-4-5 (wheel) as a special case
 */
function getStraightHighCard(cards: Card[]): number {
  const values = sortByRank(cards).map(c => rankValue(c.rank));
  
  // Check for regular straight
  let isStraight = true;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      isStraight = false;
      break;
    }
  }
  
  if (isStraight) {
    return values[0]; // High card
  }
  
  // Check for wheel (A-2-3-4-5)
  const wheel = [14, 5, 4, 3, 2];
  if (values.every((v, i) => v === wheel[i])) {
    return 5; // 5-high straight
  }
  
  return 0;
}

/**
 * Calculate a score for tie-breaking within the same hand rank
 * Higher score = better hand
 */
function calculateScore(cards: Card[], handRank: HandRank): number {
  const sorted = sortByRank(cards);
  const groups = groupByRank(cards);
  const groupSizes = Array.from(groups.values())
    .map(g => ({ size: g.length, rank: rankValue(g[0].rank) }))
    .sort((a, b) => b.size - a.size || b.rank - a.rank);
  
  // Base score from hand rank (multiply by large number to ensure rank dominates)
  let score = HAND_RANK_VALUES[handRank] * 1000000;
  
  switch (handRank) {
    case 'royal-flush':
      // All royal flushes are equal
      break;
      
    case 'straight-flush':
    case 'straight':
      // Score by high card of straight
      score += getStraightHighCard(cards) * 100;
      break;
      
    case 'four-of-a-kind':
      // Score by quad rank, then kicker
      score += groupSizes[0].rank * 100 + groupSizes[1].rank;
      break;
      
    case 'full-house':
      // Score by trips rank, then pair rank
      score += groupSizes[0].rank * 100 + groupSizes[1].rank;
      break;
      
    case 'flush':
    case 'high-card':
      // Score by each card rank in order
      for (let i = 0; i < sorted.length; i++) {
        score += rankValue(sorted[i].rank) * Math.pow(15, 4 - i);
      }
      break;
      
    case 'three-of-a-kind':
      // Score by trips rank, then kickers
      score += groupSizes[0].rank * 10000;
      const tripsKickers = groupSizes.slice(1).map(g => g.rank).sort((a, b) => b - a);
      score += tripsKickers[0] * 100 + tripsKickers[1];
      break;
      
    case 'two-pair':
      // Score by high pair, low pair, then kicker
      const pairs = groupSizes.filter(g => g.size === 2).sort((a, b) => b.rank - a.rank);
      const twoPairKicker = groupSizes.find(g => g.size === 1)!;
      score += pairs[0].rank * 10000 + pairs[1].rank * 100 + twoPairKicker.rank;
      break;
      
    case 'pair':
      // Score by pair rank, then kickers
      score += groupSizes[0].rank * 100000;
      const pairKickers = groupSizes.slice(1).map(g => g.rank).sort((a, b) => b - a);
      score += pairKickers[0] * 1000 + pairKickers[1] * 10 + pairKickers[2];
      break;
  }
  
  return score;
}

/**
 * Evaluate a 5-card hand
 */
function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error('Must evaluate exactly 5 cards');
  }
  
  const sorted = sortByRank(cards);
  const groups = groupByRank(cards);
  const groupSizes = Array.from(groups.values())
    .map(g => g.length)
    .sort((a, b) => b - a);
  
  const flush = isFlush(cards);
  const straightHigh = getStraightHighCard(cards);
  const straight = straightHigh > 0;
  
  let rank: HandRank;
  
  // Check for royal flush
  if (flush && straight && straightHigh === 14) {
    rank = 'royal-flush';
  }
  // Check for straight flush
  else if (flush && straight) {
    rank = 'straight-flush';
  }
  // Check for four of a kind
  else if (groupSizes[0] === 4) {
    rank = 'four-of-a-kind';
  }
  // Check for full house
  else if (groupSizes[0] === 3 && groupSizes[1] === 2) {
    rank = 'full-house';
  }
  // Check for flush
  else if (flush) {
    rank = 'flush';
  }
  // Check for straight
  else if (straight) {
    rank = 'straight';
  }
  // Check for three of a kind
  else if (groupSizes[0] === 3) {
    rank = 'three-of-a-kind';
  }
  // Check for two pair
  else if (groupSizes[0] === 2 && groupSizes[1] === 2) {
    rank = 'two-pair';
  }
  // Check for pair
  else if (groupSizes[0] === 2) {
    rank = 'pair';
  }
  // High card
  else {
    rank = 'high-card';
  }
  
  return {
    rank,
    rankValue: HAND_RANK_VALUES[rank],
    name: HAND_RANK_NAMES[rank],
    cards: sorted,
    score: calculateScore(cards, rank),
  };
}

/**
 * Evaluate the best 5-card hand from 7 cards (2 hole + 5 community)
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate');
  }
  
  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }
  
  // Generate all 5-card combinations and find the best
  const allCombinations = combinations(cards, 5);
  let bestHand: EvaluatedHand | null = null;
  
  for (const combo of allCombinations) {
    const evaluated = evaluateFiveCards(combo);
    if (!bestHand || evaluated.score > bestHand.score) {
      bestHand = evaluated;
    }
  }
  
  return bestHand!;
}

/**
 * Compare two evaluated hands
 * Returns positive if hand1 wins, negative if hand2 wins, 0 if tie
 */
export function compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
  return hand1.score - hand2.score;
}

/**
 * Find the winner(s) from a list of hands
 * Returns indices of winning hands (multiple in case of tie)
 */
export function findWinners(hands: EvaluatedHand[]): number[] {
  if (hands.length === 0) return [];
  if (hands.length === 1) return [0];
  
  let maxScore = hands[0].score;
  let winners = [0];
  
  for (let i = 1; i < hands.length; i++) {
    if (hands[i].score > maxScore) {
      maxScore = hands[i].score;
      winners = [i];
    } else if (hands[i].score === maxScore) {
      winners.push(i);
    }
  }
  
  return winners;
}

/**
 * HandEvaluator class for convenience
 */
export class HandEvaluator {
  /**
   * Evaluate the best hand from given cards
   */
  static evaluate(cards: Card[]): EvaluatedHand {
    return evaluateHand(cards);
  }
  
  /**
   * Compare two hands
   */
  static compare(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
    return compareHands(hand1, hand2);
  }
  
  /**
   * Find winners from multiple hands
   */
  static findWinners(hands: EvaluatedHand[]): number[] {
    return findWinners(hands);
  }
}
