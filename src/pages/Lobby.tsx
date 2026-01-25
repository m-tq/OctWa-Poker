import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/ui/Button';
import { TableList, CreateTableDialog, BuyInDialog, GameWalletBuyInDialog } from '@/components/lobby';
import { Leaderboard } from '@/components/table';
import { Plus, RefreshCw, Trophy } from 'lucide-react';
import type { Table } from '@/types/game';

export function Lobby() {
  const navigate = useNavigate();
  const { connected, connection, tables, tablesLoading, octBalance, username, gameWalletEnabled, addError } = useStore();
  const { createTable, joinTable, refreshTables, isJoining } = useSocket();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBuyInDialog, setShowBuyInDialog] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="text-center">
          <p className="text-muted mb-4">Please connect your wallet to view tables</p>
        </div>
      </div>
    );
  }

  const handleJoinClick = (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (table) {
      setSelectedTable(table);
      setShowBuyInDialog(true);
    }
  };

  const handleConfirmBuyIn = (buyIn: number, seatIndex: number, sessionId?: string) => {
    if (!selectedTable || !connection) return;
    
    setJoinError(null);
    
    // Use stored username or fallback to truncated address
    const playerName = username || `Player_${connection.walletPubKey.slice(0, 6)}`;
    
    joinTable({
      tableId: selectedTable.id,
      buyIn,
      seatIndex,
      address: connection.walletPubKey,
      name: playerName,
      // Include escrow session ID if using escrow
      ...(sessionId && { escrowSessionId: sessionId }),
    }, (success, error) => {
      if (success) {
        setShowBuyInDialog(false);
        setSelectedTable(null);
        navigate(`/table/${selectedTable.id}`);
      } else {
        setJoinError(error || 'Failed to join table');
        addError('JOIN_FAILED', error || 'Failed to join table');
      }
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Poker Tables</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowLeaderboard(true)}>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </Button>
          <Button variant="secondary" onClick={refreshTables}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Table
          </Button>
        </div>
      </div>

      <TableList 
        tables={tables} 
        loading={tablesLoading}
        onJoin={handleJoinClick}
      />

      <CreateTableDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={createTable}
      />

      <BuyInDialog
        open={showBuyInDialog && !gameWalletEnabled}
        onClose={() => {
          setShowBuyInDialog(false);
          setSelectedTable(null);
          setJoinError(null);
        }}
        table={selectedTable}
        walletBalance={octBalance ?? 0}
        onConfirm={handleConfirmBuyIn}
        isJoining={isJoining}
        error={joinError}
      />

      <GameWalletBuyInDialog
        open={showBuyInDialog && gameWalletEnabled}
        onClose={() => {
          setShowBuyInDialog(false);
          setSelectedTable(null);
          setJoinError(null);
        }}
        table={selectedTable}
        walletBalance={octBalance ?? 0}
        walletAddress={connection?.walletPubKey ?? ''}
        playerName={username || `Player_${connection?.walletPubKey?.slice(0, 6) ?? ''}`}
        onConfirm={handleConfirmBuyIn}
        isJoining={isJoining}
        error={joinError}
        gameWalletEnabled={gameWalletEnabled}
      />

      <Leaderboard open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
}
