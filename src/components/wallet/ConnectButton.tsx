import { useWallet } from '@/hooks/useWallet';
import { useStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Wallet, LogOut, Shield, Loader2 } from 'lucide-react';

export function ConnectButton() {
  const {
    connected,
    connection,
    octBalance,
    step,
    loading,
    handleConnect,
    handleAuthorize,
    handleDisconnect,
  } = useWallet();
  
  const { balanceLoading } = useStore();

  if (connected && connection) {
    const truncatedAddress = `${connection.walletPubKey.slice(0, 6)}...${connection.walletPubKey.slice(-4)}`;
    
    // Need authorization (fallback if auto-auth failed)
    if (step === 'authorize') {
      return (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted" />
            <span className="text-sm text-foreground">{truncatedAddress}</span>
          </div>
          <Button onClick={handleAuthorize} loading={loading} size="sm" variant="primary">
            <Shield className="w-4 h-4 mr-2" />
            Authorize
          </Button>
        </div>
      );
    }
    
    // Fully connected
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm">
          <span className="text-muted">Balance:</span>{' '}
          <span className="text-foreground font-medium">
            {balanceLoading ? (
              <Loader2 className="w-3 h-3 inline animate-spin ml-1" />
            ) : octBalance !== null ? (
              `${octBalance.toLocaleString()} OCT`
            ) : (
              '...'
            )}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-muted" />
          <span className="text-sm text-foreground">{truncatedAddress}</span>
        </div>
        <Button 
          variant="secondary" 
          onClick={handleDisconnect}
          className="p-2"
          aria-label="Disconnect wallet"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} loading={loading}>
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  );
}
