import { v4 as uuidv4 } from 'uuid';
import type { Table, Hand, Card, Player, ActionType, HandResult, EvaluatedHand, Rank, Suit } from '../types/index.js';
import { secureShuffle } from '../utils/security.js';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['C', 'D', 'H', 'S'];

// Create and shuffle deck using cryptographically secure randomness
function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  // Use cryptographically secure shuffle
  return secureShuffle(deck);
}

// Get rank value
function rankValue(rank: Rank): number {
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[rank];
}

export class GameManager {
  private deck: Card[] = [];
  private turnTimer: NodeJS.Timeout | null = null;
  private turnTimeoutCallback: (() => void) | null = null;

  startHand(table: Table): Hand | null {
    const activePlayers = table.players.filter((p): p is Player => 
      p !== null && p.status !== 'sitting-out' && p.stack > 0 && p.isConnected
    );

    if (activePlayers.length < 2) {
      console.log(`[GameManager] Cannot start hand - only ${activePlayers.length} active players with chips`);
      return null;
    }

    // Create and shuffle deck
    this.deck = createShuffledDeck();

    // Find dealer position (rotate from previous hand or start at 0)
    const previousDealer = table.currentHand?.dealerIndex ?? -1;
    let dealerIndex = (previousDealer + 1) % table.maxPlayers;
    
    // Find next valid dealer (player with chips)
    let attempts = 0;
    while (attempts < table.maxPlayers) {
      const player = table.players[dealerIndex];
      if (player && player.stack > 0 && player.isConnected && player.status !== 'sitting-out') {
        break;
      }
      dealerIndex = (dealerIndex + 1) % table.maxPlayers;
      attempts++;
    }

    // Deal hole cards only to players with chips
    for (const player of activePlayers) {
      player.holeCards = [this.deck.pop()!, this.deck.pop()!];
      player.bet = 0;
      player.status = 'active';
    }

    // Post blinds
    const sbIndex = this.getNextActivePlayer(table, dealerIndex);
    const bbIndex = this.getNextActivePlayer(table, sbIndex);
    
    const sbPlayer = table.players[sbIndex]!;
    const bbPlayer = table.players[bbIndex]!;
    
    const sbAmount = Math.min(table.smallBlind, sbPlayer.stack);
    const bbAmount = Math.min(table.bigBlind, bbPlayer.stack);
    
    sbPlayer.bet = sbAmount;
    sbPlayer.stack -= sbAmount;
    if (sbPlayer.stack === 0) sbPlayer.status = 'all-in';
    
    bbPlayer.bet = bbAmount;
    bbPlayer.stack -= bbAmount;
    if (bbPlayer.stack === 0) bbPlayer.status = 'all-in';

    // First to act is after big blind
    const firstToAct = this.getNextActivePlayer(table, bbIndex);

    const hand: Hand = {
      id: uuidv4(),
      communityCards: [],
      pot: sbAmount + bbAmount,
      sidePots: [],
      currentBet: bbAmount,
      dealerIndex,
      activePlayerIndex: firstToAct,
      stage: 'preflop',
      actions: [],
    };

    table.currentHand = hand;
    return hand;
  }

  processAction(
    table: Table,
    playerId: string,
    action: ActionType,
    amount?: number
  ): { success: boolean; error?: string } {
    const hand = table.currentHand;
    if (!hand) {
      return { success: false, error: 'No active hand' };
    }

    const player = table.players.find(p => p?.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const activePlayer = table.players[hand.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate player can act
    if (player.status !== 'active') {
      return { success: false, error: 'Cannot act - player is ' + player.status };
    }

    // Process action
    switch (action) {
      case 'fold':
        player.status = 'folded';
        break;

      case 'check':
        if (player.bet < hand.currentBet) {
          return { success: false, error: 'Cannot check - must call or fold' };
        }
        break;

      case 'call': {
        const callAmount = Math.min(hand.currentBet - player.bet, player.stack);
        if (callAmount <= 0 && hand.currentBet > player.bet) {
          return { success: false, error: 'Cannot call - insufficient stack' };
        }
        player.bet += callAmount;
        player.stack -= callAmount;
        hand.pot += callAmount;
        if (player.stack === 0) player.status = 'all-in';
        break;
      }

      case 'bet':
      case 'raise': {
        if (amount === undefined || amount <= 0) {
          return { success: false, error: 'Amount required for bet/raise' };
        }
        
        // Validate minimum bet/raise
        const minBet = action === 'bet' ? table.bigBlind : hand.currentBet + table.bigBlind;
        const totalBet = action === 'bet' ? amount : hand.currentBet + amount;
        
        if (totalBet < minBet && totalBet !== player.stack + player.bet) {
          // Allow all-in even if less than min bet
          return { success: false, error: `Minimum ${action} is ${minBet}` };
        }
        
        const betAmount = totalBet - player.bet;
        
        if (betAmount > player.stack) {
          return { success: false, error: 'Not enough chips' };
        }
        
        player.bet = totalBet;
        player.stack -= betAmount;
        hand.pot += betAmount;
        hand.currentBet = totalBet;
        if (player.stack === 0) player.status = 'all-in';
        break;
      }

      case 'all-in': {
        if (player.stack <= 0) {
          return { success: false, error: 'No chips to go all-in' };
        }
        const allInAmount = player.stack;
        player.bet += allInAmount;
        player.stack = 0;
        hand.pot += allInAmount;
        player.status = 'all-in';
        if (player.bet > hand.currentBet) {
          hand.currentBet = player.bet;
        }
        break;
      }

      default:
        return { success: false, error: 'Invalid action' };
    }

    // Record action
    hand.actions.push({
      playerId,
      type: action,
      amount,
      timestamp: Date.now(),
    });

    // Move to next player or next stage
    this.advanceGame(table);

    return { success: true };
  }

  private advanceGame(table: Table): void {
    const hand = table.currentHand!;
    
    // Check if only one player remains (not folded)
    const activePlayers = table.players.filter((p): p is Player => 
      p !== null && p.status !== 'folded' && p.status !== 'sitting-out'
    );

    if (activePlayers.length === 1) {
      // Hand is over - single winner
      return;
    }

    // Check if all remaining players are all-in (or only one can act)
    const playersWhoCanAct = activePlayers.filter(p => p.status === 'active' && p.stack > 0);
    
    if (playersWhoCanAct.length <= 1) {
      // Everyone is all-in or only one player can act
      // Check if betting is complete (all bets matched or all-in)
      const maxBet = Math.max(...activePlayers.map(p => p.bet));
      const allBetsMatched = activePlayers.every(p => p.bet === maxBet || p.status === 'all-in');
      
      if (allBetsMatched) {
        // Run out the board
        this.runOutBoard(table);
        return;
      }
    }

    // Check if betting round is complete
    // A round is complete when all active players have either:
    // 1. Matched the current bet, or
    // 2. Gone all-in
    // AND everyone has had a chance to act
    const playersToAct = activePlayers.filter(p => {
      if (p.status !== 'active') return false; // All-in players don't need to act
      if (p.bet < hand.currentBet) return true; // Must call or fold
      // Check if player has acted this round
      const roundStartIndex = this.getRoundStartActionIndex(hand);
      const hasActedThisRound = hand.actions.slice(roundStartIndex).some(a => a.playerId === p.id);
      return !hasActedThisRound;
    });

    if (playersToAct.length === 0) {
      // Advance to next stage
      this.advanceStage(table);
    } else {
      // Move to next player who can act
      hand.activePlayerIndex = this.getNextActivePlayer(table, hand.activePlayerIndex);
    }
  }

  private getRoundStartActionIndex(hand: Hand): number {
    // Find where the current betting round started
    // This is after the last stage change (or start of hand for preflop)
    const stageActions = ['preflop', 'flop', 'turn', 'river'];
    const currentStageIndex = stageActions.indexOf(hand.stage);
    
    if (currentStageIndex === 0) {
      // Preflop - skip blind posts (first 2 actions are blinds conceptually)
      return 0;
    }
    
    // For other stages, round starts at beginning since we reset bets
    return hand.actions.length - hand.actions.filter(a => {
      // Count actions in current stage
      return true;
    }).length;
  }

  private runOutBoard(table: Table): void {
    const hand = table.currentHand!;
    
    // Deal remaining community cards
    while (hand.stage !== 'showdown') {
      switch (hand.stage) {
        case 'preflop':
          this.deck.pop(); // Burn
          hand.communityCards = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
          hand.stage = 'flop';
          break;
        case 'flop':
          this.deck.pop(); // Burn
          hand.communityCards.push(this.deck.pop()!);
          hand.stage = 'turn';
          break;
        case 'turn':
          this.deck.pop(); // Burn
          hand.communityCards.push(this.deck.pop()!);
          hand.stage = 'river';
          break;
        case 'river':
          hand.stage = 'showdown';
          break;
      }
    }
  }

  private advanceStage(table: Table): void {
    const hand = table.currentHand!;
    
    // Reset bets for new round
    for (const player of table.players) {
      if (player) player.bet = 0;
    }
    hand.currentBet = 0;

    switch (hand.stage) {
      case 'preflop':
        // Deal flop
        this.deck.pop(); // Burn card
        hand.communityCards = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
        hand.stage = 'flop';
        break;

      case 'flop':
        // Deal turn
        this.deck.pop(); // Burn card
        hand.communityCards.push(this.deck.pop()!);
        hand.stage = 'turn';
        break;

      case 'turn':
        // Deal river
        this.deck.pop(); // Burn card
        hand.communityCards.push(this.deck.pop()!);
        hand.stage = 'river';
        break;

      case 'river':
        // Go to showdown
        hand.stage = 'showdown';
        return;
    }

    // Set first to act (left of dealer)
    hand.activePlayerIndex = this.getNextActivePlayer(table, hand.dealerIndex);
  }

  private getNextActivePlayer(table: Table, fromIndex: number): number {
    let index = (fromIndex + 1) % table.maxPlayers;
    let iterations = 0;
    
    while (iterations < table.maxPlayers) {
      const player = table.players[index];
      // Player must be active, have chips, and be connected
      if (player && player.status === 'active' && player.stack >= 0 && player.isConnected) {
        return index;
      }
      index = (index + 1) % table.maxPlayers;
      iterations++;
    }
    
    return fromIndex;
  }

  evaluateShowdown(table: Table): HandResult | null {
    const hand = table.currentHand;
    if (!hand || hand.stage !== 'showdown') {
      return null;
    }

    const activePlayers = table.players.filter((p): p is Player => 
      p !== null && p.status !== 'folded' && p.status !== 'sitting-out' && p.holeCards !== null
    );

    if (activePlayers.length === 0) {
      return null;
    }

    // Evaluate each player's hand
    const playerHands: { player: Player; evaluated: EvaluatedHand }[] = activePlayers.map(player => ({
      player,
      evaluated: this.evaluateHand([...player.holeCards!, ...hand.communityCards]),
    }));

    // Find winner(s)
    const maxScore = Math.max(...playerHands.map(ph => ph.evaluated.score));
    const winners = playerHands.filter(ph => ph.evaluated.score === maxScore);

    // Distribute pot
    const winAmount = Math.floor(hand.pot / winners.length);
    const remainder = hand.pot % winners.length;

    const result: HandResult = {
      winners: winners.map((w, i) => ({
        playerId: w.player.id,
        amount: winAmount + (i === 0 ? remainder : 0),
        hand: w.evaluated,
      })),
      showdown: playerHands.map(ph => ({
        playerId: ph.player.id,
        holeCards: ph.player.holeCards!,
        hand: ph.evaluated,
      })),
    };

    // Update stacks
    for (const winner of result.winners) {
      const player = table.players.find(p => p?.id === winner.playerId);
      if (player) {
        player.stack += winner.amount;
      }
    }

    return result;
  }

  private evaluateHand(cards: Card[]): EvaluatedHand {
    // Simplified hand evaluation - find best 5-card hand from 7 cards
    const combinations = this.getCombinations(cards, 5);
    let bestHand: EvaluatedHand | null = null;

    for (const combo of combinations) {
      const evaluated = this.evaluateFiveCards(combo);
      if (!bestHand || evaluated.score > bestHand.score) {
        bestHand = evaluated;
      }
    }

    return bestHand!;
  }

  private getCombinations(cards: Card[], size: number): Card[][] {
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

  private evaluateFiveCards(cards: Card[]): EvaluatedHand {
    const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
    const ranks = sorted.map(c => rankValue(c.rank));
    const suits = sorted.map(c => c.suit);
    
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.checkStraight(ranks);
    const groups = this.groupByRank(sorted);
    const groupSizes = Object.values(groups).map(g => g.length).sort((a, b) => b - a);

    let rank: EvaluatedHand['rank'];
    let score = 0;

    if (isFlush && isStraight && ranks[0] === 14) {
      rank = 'royal-flush';
      score = 10000000;
    } else if (isFlush && isStraight) {
      rank = 'straight-flush';
      score = 9000000 + ranks[0];
    } else if (groupSizes[0] === 4) {
      rank = 'four-of-a-kind';
      score = 8000000 + this.getGroupScore(groups, 4) * 100;
    } else if (groupSizes[0] === 3 && groupSizes[1] === 2) {
      rank = 'full-house';
      score = 7000000 + this.getGroupScore(groups, 3) * 100 + this.getGroupScore(groups, 2);
    } else if (isFlush) {
      rank = 'flush';
      score = 6000000 + this.getKickerScore(ranks);
    } else if (isStraight) {
      rank = 'straight';
      score = 5000000 + (ranks[0] === 14 && ranks[1] === 5 ? 5 : ranks[0]);
    } else if (groupSizes[0] === 3) {
      rank = 'three-of-a-kind';
      score = 4000000 + this.getGroupScore(groups, 3) * 10000;
    } else if (groupSizes[0] === 2 && groupSizes[1] === 2) {
      rank = 'two-pair';
      score = 3000000 + this.getTwoPairScore(groups);
    } else if (groupSizes[0] === 2) {
      rank = 'pair';
      score = 2000000 + this.getGroupScore(groups, 2) * 10000 + this.getKickerScore(ranks);
    } else {
      rank = 'high-card';
      score = 1000000 + this.getKickerScore(ranks);
    }

    const rankNames: Record<EvaluatedHand['rank'], string> = {
      'royal-flush': 'Royal Flush',
      'straight-flush': 'Straight Flush',
      'four-of-a-kind': 'Four of a Kind',
      'full-house': 'Full House',
      'flush': 'Flush',
      'straight': 'Straight',
      'three-of-a-kind': 'Three of a Kind',
      'two-pair': 'Two Pair',
      'pair': 'Pair',
      'high-card': 'High Card',
    };

    const rankValues: Record<EvaluatedHand['rank'], number> = {
      'high-card': 1, 'pair': 2, 'two-pair': 3, 'three-of-a-kind': 4,
      'straight': 5, 'flush': 6, 'full-house': 7, 'four-of-a-kind': 8,
      'straight-flush': 9, 'royal-flush': 10,
    };

    return {
      rank,
      rankValue: rankValues[rank],
      name: rankNames[rank],
      cards: sorted,
      score,
    };
  }

  private checkStraight(ranks: number[]): boolean {
    // Check regular straight
    for (let i = 0; i < ranks.length - 1; i++) {
      if (ranks[i] - ranks[i + 1] !== 1) {
        // Check for wheel (A-2-3-4-5)
        if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
          return true;
        }
        return false;
      }
    }
    return true;
  }

  private groupByRank(cards: Card[]): Record<string, Card[]> {
    const groups: Record<string, Card[]> = {};
    for (const card of cards) {
      if (!groups[card.rank]) groups[card.rank] = [];
      groups[card.rank].push(card);
    }
    return groups;
  }

  private getGroupScore(groups: Record<string, Card[]>, size: number): number {
    for (const [rank, cards] of Object.entries(groups)) {
      if (cards.length === size) {
        return rankValue(rank as Rank);
      }
    }
    return 0;
  }

  private getTwoPairScore(groups: Record<string, Card[]>): number {
    const pairs = Object.entries(groups)
      .filter(([_, cards]) => cards.length === 2)
      .map(([rank]) => rankValue(rank as Rank))
      .sort((a, b) => b - a);
    return pairs[0] * 100 + pairs[1];
  }

  private getKickerScore(ranks: number[]): number {
    return ranks.reduce((score, rank, i) => score + rank * Math.pow(15, 4 - i), 0);
  }

  setTurnTimeout(callback: () => void, timeoutMs: number): void {
    this.clearTurnTimeout();
    this.turnTimeoutCallback = callback;
    this.turnTimer = setTimeout(() => {
      if (this.turnTimeoutCallback) {
        this.turnTimeoutCallback();
      }
    }, timeoutMs);
  }

  clearTurnTimeout(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnTimeoutCallback = null;
  }
}
