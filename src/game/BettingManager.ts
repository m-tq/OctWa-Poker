import type { ActionType, AvailableActions } from '@/types/game';

/**
 * Betting state for a player
 */
export interface PlayerBettingState {
  playerId: string;
  stack: number;
  currentBet: number;
  totalBetThisRound: number;
  hasActed: boolean;
  isFolded: boolean;
  isAllIn: boolean;
}

/**
 * Game betting state
 */
export interface BettingState {
  players: PlayerBettingState[];
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  pot: number;
  lastRaiseAmount: number;
}

/**
 * Get available actions for a player based on current betting state
 */
export function getValidActions(
  player: PlayerBettingState,
  state: BettingState
): AvailableActions {
  const { stack, currentBet } = player;
  const { currentBet: tableBet, bigBlind, lastRaiseAmount } = state;
  
  // Player has folded or is all-in - no actions available
  if (player.isFolded || player.isAllIn) {
    return {
      canFold: false,
      canCheck: false,
      canCall: false,
      canBet: false,
      canRaise: false,
      canAllIn: false,
      callAmount: 0,
      minBet: 0,
      minRaise: 0,
      maxRaise: 0,
    };
  }
  
  const callAmount = tableBet - currentBet;
  const canAffordCall = stack >= callAmount;
  
  // Calculate minimum raise
  // Min raise = current bet + last raise amount (or big blind if no raise yet)
  const minRaiseAmount = Math.max(lastRaiseAmount, bigBlind);
  const minRaiseTotal = tableBet + minRaiseAmount;
  const canAffordMinRaise = stack > callAmount && stack >= minRaiseTotal - currentBet;
  
  // No bet on table
  if (tableBet === 0 || tableBet === currentBet) {
    return {
      canFold: false, // Can't fold when you can check
      canCheck: true,
      canCall: false,
      canBet: stack > 0,
      canRaise: false,
      canAllIn: stack > 0,
      callAmount: 0,
      minBet: bigBlind,
      minRaise: 0,
      maxRaise: stack,
    };
  }
  
  // There's a bet to call
  return {
    canFold: true,
    canCheck: false,
    canCall: canAffordCall && callAmount < stack, // Can call if not all-in
    canBet: false, // Can't bet when there's already a bet
    canRaise: canAffordMinRaise,
    canAllIn: stack > 0,
    callAmount,
    minBet: 0,
    minRaise: minRaiseTotal - currentBet,
    maxRaise: stack,
  };
}

/**
 * Validation result for an action
 */
export interface ActionValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a player action
 */
export function validateAction(
  action: ActionType,
  amount: number | undefined,
  player: PlayerBettingState,
  state: BettingState
): ActionValidation {
  const available = getValidActions(player, state);
  
  switch (action) {
    case 'fold':
      if (!available.canFold && !available.canCheck) {
        // Allow fold even when check is available (player's choice)
        return { valid: true };
      }
      return { valid: true };
      
    case 'check':
      if (!available.canCheck) {
        return { valid: false, error: 'Cannot check - there is a bet to call' };
      }
      return { valid: true };
      
    case 'call':
      if (!available.canCall) {
        if (player.stack <= available.callAmount) {
          return { valid: false, error: 'Not enough chips to call - use all-in instead' };
        }
        return { valid: false, error: 'Cannot call' };
      }
      return { valid: true };
      
    case 'bet':
      if (!available.canBet) {
        return { valid: false, error: 'Cannot bet - there is already a bet on the table' };
      }
      if (amount === undefined) {
        return { valid: false, error: 'Bet amount required' };
      }
      if (amount < available.minBet) {
        return { valid: false, error: `Minimum bet is ${available.minBet}` };
      }
      if (amount > player.stack) {
        return { valid: false, error: 'Not enough chips' };
      }
      return { valid: true };
      
    case 'raise':
      if (!available.canRaise) {
        return { valid: false, error: 'Cannot raise - not enough chips for minimum raise' };
      }
      if (amount === undefined) {
        return { valid: false, error: 'Raise amount required' };
      }
      if (amount < available.minRaise) {
        return { valid: false, error: `Minimum raise is ${available.minRaise}` };
      }
      if (amount > available.maxRaise) {
        return { valid: false, error: 'Not enough chips' };
      }
      return { valid: true };
      
    case 'all-in':
      if (!available.canAllIn) {
        return { valid: false, error: 'Cannot go all-in' };
      }
      return { valid: true };
      
    default:
      return { valid: false, error: 'Invalid action' };
  }
}

/**
 * Apply an action to the betting state
 * Returns the new state and the actual amount bet
 */
export function applyAction(
  action: ActionType,
  amount: number | undefined,
  playerId: string,
  state: BettingState
): { newState: BettingState; betAmount: number } {
  const playerIndex = state.players.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found');
  }
  
  const player = state.players[playerIndex];
  const newPlayers = [...state.players];
  let betAmount = 0;
  let newCurrentBet = state.currentBet;
  let newLastRaise = state.lastRaiseAmount;
  let newPot = state.pot;
  
  switch (action) {
    case 'fold':
      newPlayers[playerIndex] = {
        ...player,
        isFolded: true,
        hasActed: true,
      };
      break;
      
    case 'check':
      newPlayers[playerIndex] = {
        ...player,
        hasActed: true,
      };
      break;
      
    case 'call': {
      const callAmount = state.currentBet - player.currentBet;
      betAmount = Math.min(callAmount, player.stack);
      const isAllIn = betAmount === player.stack;
      
      newPlayers[playerIndex] = {
        ...player,
        stack: player.stack - betAmount,
        currentBet: player.currentBet + betAmount,
        totalBetThisRound: player.totalBetThisRound + betAmount,
        hasActed: true,
        isAllIn,
      };
      newPot += betAmount;
      break;
    }
      
    case 'bet':
      betAmount = amount!;
      newPlayers[playerIndex] = {
        ...player,
        stack: player.stack - betAmount,
        currentBet: betAmount,
        totalBetThisRound: player.totalBetThisRound + betAmount,
        hasActed: true,
      };
      newCurrentBet = betAmount;
      newLastRaise = betAmount;
      newPot += betAmount;
      // Reset hasActed for other players
      newPlayers.forEach((p, i) => {
        if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
          newPlayers[i] = { ...p, hasActed: false };
        }
      });
      break;
      
    case 'raise': {
      betAmount = amount!;
      const totalBet = player.currentBet + betAmount;
      const raiseAmount = totalBet - state.currentBet;
      
      newPlayers[playerIndex] = {
        ...player,
        stack: player.stack - betAmount,
        currentBet: totalBet,
        totalBetThisRound: player.totalBetThisRound + betAmount,
        hasActed: true,
      };
      newCurrentBet = totalBet;
      newLastRaise = raiseAmount;
      newPot += betAmount;
      // Reset hasActed for other players
      newPlayers.forEach((p, i) => {
        if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
          newPlayers[i] = { ...p, hasActed: false };
        }
      });
      break;
    }
      
    case 'all-in': {
      betAmount = player.stack;
      const totalBet = player.currentBet + betAmount;
      
      // Check if this is a raise
      if (totalBet > state.currentBet) {
        const raiseAmount = totalBet - state.currentBet;
        if (raiseAmount >= state.lastRaiseAmount) {
          newLastRaise = raiseAmount;
          // Reset hasActed for other players
          newPlayers.forEach((p, i) => {
            if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
              newPlayers[i] = { ...p, hasActed: false };
            }
          });
        }
        newCurrentBet = totalBet;
      }
      
      newPlayers[playerIndex] = {
        ...player,
        stack: 0,
        currentBet: totalBet,
        totalBetThisRound: player.totalBetThisRound + betAmount,
        hasActed: true,
        isAllIn: true,
      };
      newPot += betAmount;
      break;
    }
  }
  
  return {
    newState: {
      ...state,
      players: newPlayers,
      currentBet: newCurrentBet,
      lastRaiseAmount: newLastRaise,
      pot: newPot,
    },
    betAmount,
  };
}

/**
 * Check if betting round is complete
 */
export function isBettingRoundComplete(state: BettingState): boolean {
  const activePlayers = state.players.filter(p => !p.isFolded && !p.isAllIn);
  
  // If only one player left (others folded), round is complete
  const nonFoldedPlayers = state.players.filter(p => !p.isFolded);
  if (nonFoldedPlayers.length <= 1) {
    return true;
  }
  
  // If all active players have acted and bets are equal, round is complete
  const allActed = activePlayers.every(p => p.hasActed);
  const allBetsEqual = activePlayers.every(p => p.currentBet === state.currentBet);
  
  return allActed && allBetsEqual;
}

/**
 * Reset betting state for new round (flop, turn, river)
 */
export function resetForNewRound(state: BettingState): BettingState {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      currentBet: 0,
      hasActed: false,
    })),
    currentBet: 0,
    lastRaiseAmount: state.bigBlind,
  };
}

/**
 * BettingManager class for convenience
 */
export class BettingManager {
  static getValidActions(player: PlayerBettingState, state: BettingState): AvailableActions {
    return getValidActions(player, state);
  }
  
  static validateAction(
    action: ActionType,
    amount: number | undefined,
    player: PlayerBettingState,
    state: BettingState
  ): ActionValidation {
    return validateAction(action, amount, player, state);
  }
  
  static applyAction(
    action: ActionType,
    amount: number | undefined,
    playerId: string,
    state: BettingState
  ): { newState: BettingState; betAmount: number } {
    return applyAction(action, amount, playerId, state);
  }
  
  static isBettingRoundComplete(state: BettingState): boolean {
    return isBettingRoundComplete(state);
  }
  
  static resetForNewRound(state: BettingState): BettingState {
    return resetForNewRound(state);
  }
}
