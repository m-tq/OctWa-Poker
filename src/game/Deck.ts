import type { Card, Rank, Suit } from '@/types/game';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['C', 'D', 'H', 'S'];

/**
 * Creates a standard 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 * Shuffles the deck in place and returns it
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deck class for managing a poker deck
 */
export class Deck {
  private cards: Card[];
  private dealtCards: Card[] = [];

  constructor() {
    this.cards = shuffleDeck(createDeck());
  }

  /**
   * Deal a specified number of cards from the deck
   * @param count Number of cards to deal
   * @returns Array of dealt cards
   * @throws Error if not enough cards in deck
   */
  deal(count: number): Card[] {
    if (count > this.cards.length) {
      throw new Error(`Cannot deal ${count} cards, only ${this.cards.length} remaining`);
    }

    const dealt = this.cards.splice(0, count);
    this.dealtCards.push(...dealt);
    return dealt;
  }

  /**
   * Get the number of remaining cards in the deck
   */
  get remaining(): number {
    return this.cards.length;
  }

  /**
   * Get all cards that have been dealt
   */
  get dealt(): Card[] {
    return [...this.dealtCards];
  }

  /**
   * Reset the deck with a fresh shuffle
   */
  reset(): void {
    this.cards = shuffleDeck(createDeck());
    this.dealtCards = [];
  }

  /**
   * Check if a card has been dealt
   */
  isDealt(card: Card): boolean {
    return this.dealtCards.some(c => c.rank === card.rank && c.suit === card.suit);
  }

  /**
   * Get all cards (for testing/debugging)
   */
  getAllCards(): Card[] {
    return [...this.cards, ...this.dealtCards];
  }
}

/**
 * Convert card to string representation (e.g., "AS" for Ace of Spades)
 */
export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

/**
 * Parse string to card (e.g., "AS" -> { rank: 'A', suit: 'S' })
 */
export function parseCard(str: string): Card {
  if (str.length !== 2) {
    throw new Error(`Invalid card string: ${str}`);
  }
  const rank = str[0] as Rank;
  const suit = str[1] as Suit;
  
  if (!RANKS.includes(rank)) {
    throw new Error(`Invalid rank: ${rank}`);
  }
  if (!SUITS.includes(suit)) {
    throw new Error(`Invalid suit: ${suit}`);
  }
  
  return { rank, suit };
}

/**
 * Compare two cards for equality
 */
export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/**
 * Get the numeric value of a rank (2-14, where A=14)
 */
export function rankValue(rank: Rank): number {
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[rank];
}

/**
 * Get display name for a suit
 */
export function suitName(suit: Suit): string {
  const names: Record<Suit, string> = {
    'C': 'Clubs',
    'D': 'Diamonds',
    'H': 'Hearts',
    'S': 'Spades'
  };
  return names[suit];
}

/**
 * Get display name for a rank
 */
export function rankName(rank: Rank): string {
  const names: Record<Rank, string> = {
    '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
    '7': 'Seven', '8': 'Eight', '9': 'Nine', 'T': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
  };
  return names[rank];
}

/**
 * Get suit symbol for display
 */
export function suitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    'C': '♣',
    'D': '♦',
    'H': '♥',
    'S': '♠'
  };
  return symbols[suit];
}
