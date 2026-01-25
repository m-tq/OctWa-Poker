import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Table } from '@/types/game';

interface TableCardProps {
  table: Table;
  onJoin: (tableId: string) => void;
}

export function TableCard({ table, onJoin }: TableCardProps) {
  const playerCount = table.players.filter(p => p !== null).length;
  const isFull = playerCount >= table.maxPlayers;
  const hasHand = table.currentHand !== null;

  return (
    <div className="bg-card border border-border p-4 flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-medium text-foreground">{table.name}</h3>
          {hasHand && (
            <Badge variant="success" size="sm">In Progress</Badge>
          )}
          {isFull && (
            <Badge variant="warning" size="sm">Full</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>Blinds: {table.smallBlind}/{table.bigBlind} OCT</span>
          <span>Buy-in: {table.minBuyIn}-{table.maxBuyIn} OCT</span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {playerCount}/{table.maxPlayers}
          </span>
        </div>
      </div>
      
      <Button 
        onClick={() => onJoin(table.id)}
        disabled={isFull}
        variant={isFull ? 'secondary' : 'primary'}
      >
        {isFull ? 'Full' : 'Join'}
      </Button>
    </div>
  );
}
