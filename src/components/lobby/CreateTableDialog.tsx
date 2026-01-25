import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { API_URL, DEFAULT_BLINDS, DEFAULT_BUY_IN, MAX_PLAYERS } from '@/config';

interface GameConfig {
  defaultSmallBlind: number;
  defaultBigBlind: number;
  defaultMinBuyIn: number;
  defaultMaxBuyIn: number;
  defaultMaxPlayers: number;
}

interface CreateTableDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    maxPlayers: number;
  }) => void;
}

export function CreateTableDialog({ open, onClose, onCreate }: CreateTableDialogProps) {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [name, setName] = useState('');
  const [smallBlind, setSmallBlind] = useState(DEFAULT_BLINDS.small);
  const [bigBlind, setBigBlind] = useState(DEFAULT_BLINDS.big);
  const [minBuyIn, setMinBuyIn] = useState(DEFAULT_BUY_IN.min);
  const [maxBuyIn, setMaxBuyIn] = useState(DEFAULT_BUY_IN.max);
  const [maxPlayers, setMaxPlayers] = useState(MAX_PLAYERS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch config from server when dialog opens
  useEffect(() => {
    if (open && !config) {
      fetch(`${API_URL}/api/config`)
        .then(res => res.json())
        .then((data: GameConfig) => {
          setConfig(data);
          setSmallBlind(data.defaultSmallBlind);
          setBigBlind(data.defaultBigBlind);
          setMinBuyIn(data.defaultMinBuyIn);
          setMaxBuyIn(data.defaultMaxBuyIn);
          setMaxPlayers(data.defaultMaxPlayers);
        })
        .catch(console.error);
    }
  }, [open, config]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Table name is required';
    }
    if (smallBlind <= 0) {
      newErrors.smallBlind = 'Small blind must be positive';
    }
    if (bigBlind <= smallBlind) {
      newErrors.bigBlind = 'Big blind must be greater than small blind';
    }
    if (minBuyIn < bigBlind * 10) {
      newErrors.minBuyIn = `Minimum buy-in must be at least ${(bigBlind * 10).toFixed(2)} (10 big blinds)`;
    }
    if (maxBuyIn < minBuyIn) {
      newErrors.maxBuyIn = 'Maximum buy-in must be greater than minimum';
    }
    if (maxPlayers < 2 || maxPlayers > 8) {
      newErrors.maxPlayers = 'Players must be between 2 and 8';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    onCreate({
      name: name.trim(),
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      maxPlayers,
    });
    
    // Reset form to server config or fallback defaults
    setName('');
    setSmallBlind(config?.defaultSmallBlind ?? DEFAULT_BLINDS.small);
    setBigBlind(config?.defaultBigBlind ?? DEFAULT_BLINDS.big);
    setMinBuyIn(config?.defaultMinBuyIn ?? DEFAULT_BUY_IN.min);
    setMaxBuyIn(config?.defaultMaxBuyIn ?? DEFAULT_BUY_IN.max);
    setMaxPlayers(config?.defaultMaxPlayers ?? MAX_PLAYERS);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Create Table">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Table Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Poker Table"
          error={errors.name}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Small Blind (OCT)"
            type="number"
            value={smallBlind}
            onChange={e => setSmallBlind(Number(e.target.value))}
            min={0.001}
            step={0.001}
            error={errors.smallBlind}
          />
          <Input
            label="Big Blind (OCT)"
            type="number"
            value={bigBlind}
            onChange={e => setBigBlind(Number(e.target.value))}
            min={0.001}
            step={0.001}
            error={errors.bigBlind}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Buy-in (OCT)"
            type="number"
            value={minBuyIn}
            onChange={e => setMinBuyIn(Number(e.target.value))}
            min={0.01}
            step={0.01}
            error={errors.minBuyIn}
          />
          <Input
            label="Max Buy-in (OCT)"
            type="number"
            value={maxBuyIn}
            onChange={e => setMaxBuyIn(Number(e.target.value))}
            min={0.01}
            step={0.01}
            error={errors.maxBuyIn}
          />
        </div>
        
        <Input
          label="Max Players"
          type="number"
          value={maxPlayers}
          onChange={e => setMaxPlayers(Number(e.target.value))}
          min={2}
          max={8}
          error={errors.maxPlayers}
        />
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Create Table
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
