import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import type { AvailableActions } from '@/types/game';
import { HelpCircle } from 'lucide-react';

interface ActionPanelProps {
  actions: AvailableActions;
  onAction: (action: string, amount?: number) => void;
  disabled?: boolean;
}

// Tooltip descriptions for each action
const ACTION_TOOLTIPS = {
  fold: 'Give up this hand. You lose the chips you already bet.',
  check: 'Pass your turn without betting. Only available if no bet is placed.',
  call: 'Match the opponent\'s bet with the same amount.',
  bet: 'Place the first bet in this round.',
  raise: 'Increase the bet higher than your opponent.',
  allIn: 'Put all your chips on the line!',
};

export function ActionPanel({ actions, onAction, disabled = false }: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(actions.minRaise || actions.minBet);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleRaiseClick = () => {
    if (showRaiseSlider) {
      onAction(actions.canBet ? 'bet' : 'raise', raiseAmount);
      setShowRaiseSlider(false);
    } else {
      setShowRaiseSlider(true);
    }
  };

  const handleFold = () => onAction('fold');
  const handleCheck = () => onAction('check');
  const handleCall = () => onAction('call');
  const handleAllIn = () => onAction('all-in');

  return (
    <div className="bg-card border border-border p-3 rounded-lg">
      {/* Help toggle */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-yellow-400 font-medium animate-pulse">
          ⏱️ Your turn! Choose an action before time runs out
        </span>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-muted hover:text-foreground transition-colors"
          title="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="mb-3 p-2 bg-secondary/50 rounded text-xs space-y-1">
          <p><span className="text-red-400 font-medium">Fold:</span> {ACTION_TOOLTIPS.fold}</p>
          <p><span className="text-gray-400 font-medium">Check:</span> {ACTION_TOOLTIPS.check}</p>
          <p><span className="text-blue-400 font-medium">Call:</span> {ACTION_TOOLTIPS.call}</p>
          <p><span className="text-primary font-medium">Bet/Raise:</span> {ACTION_TOOLTIPS.raise}</p>
          <p><span className="text-green-400 font-medium">All-In:</span> {ACTION_TOOLTIPS.allIn}</p>
        </div>
      )}

      {/* Raise slider */}
      {showRaiseSlider && (actions.canRaise || actions.canBet) && (
        <div className="mb-3">
          <Slider
            label={actions.canBet ? 'Bet Amount' : 'Raise Amount'}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            min={actions.canBet ? actions.minBet : actions.minRaise}
            max={actions.maxRaise}
            step={10}
            formatValue={v => `${v.toLocaleString()} OCT`}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-center flex-wrap">
        {actions.canFold && (
          <Button 
            variant="danger" 
            onClick={handleFold}
            disabled={disabled}
            title={ACTION_TOOLTIPS.fold}
          >
            Fold
          </Button>
        )}

        {actions.canCheck && (
          <Button 
            variant="secondary" 
            onClick={handleCheck}
            disabled={disabled}
            title={ACTION_TOOLTIPS.check}
          >
            Check
          </Button>
        )}

        {actions.canCall && (
          <Button 
            variant="secondary" 
            onClick={handleCall}
            disabled={disabled}
            title={ACTION_TOOLTIPS.call}
          >
            Call {actions.callAmount.toLocaleString()}
          </Button>
        )}

        {(actions.canBet || actions.canRaise) && (
          <Button 
            variant="primary" 
            onClick={handleRaiseClick}
            disabled={disabled}
            title={actions.canBet ? ACTION_TOOLTIPS.bet : ACTION_TOOLTIPS.raise}
          >
            {showRaiseSlider 
              ? `Confirm ${raiseAmount.toLocaleString()}` 
              : actions.canBet 
                ? 'Bet' 
                : 'Raise'
            }
          </Button>
        )}

        {actions.canAllIn && (
          <Button 
            variant="success" 
            onClick={handleAllIn}
            disabled={disabled}
            title={ACTION_TOOLTIPS.allIn}
          >
            All-In
          </Button>
        )}
      </div>

      {showRaiseSlider && (
        <div className="mt-2 text-center">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowRaiseSlider(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
