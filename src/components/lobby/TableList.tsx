import { Users } from 'lucide-react';
import { TableCard } from './TableCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Table } from '@/types/game';

interface TableListProps {
  tables: Table[];
  loading: boolean;
  onJoin: (tableId: string) => void;
  onDelete?: (tableId: string) => void;
  currentAddress?: string;
}

export function TableList({ tables, loading, onJoin, onDelete, currentAddress }: TableListProps) {
  if (loading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="bg-card border border-border p-8 text-center">
        <Users className="w-12 h-12 text-muted mx-auto mb-4" />
        <p className="text-muted">No tables available</p>
        <p className="text-sm text-muted mt-2">Create a table to start playing</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {tables.map(table => (
        <TableCard 
          key={table.id} 
          table={table} 
          onJoin={onJoin}
          onDelete={onDelete}
          currentAddress={currentAddress}
        />
      ))}
    </div>
  );
}
