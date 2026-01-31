import { Link } from 'react-router-dom';
import { useStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Spade, Users, Coins, Shield } from 'lucide-react';

export function Home() {
  const { connected } = useStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-8">
      <div className="max-w-2xl text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary/10">
            <Spade className="w-16 h-16 text-primary" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-foreground mb-4">
          OctWa Poker
        </h1>
        
        <p className="text-lg text-muted mb-8">
          Multiplayer Texas Hold'em with OCT token betting.
          Connect your OctWa wallet and join the tables.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-card border border-border">
            <Users className="w-8 h-8 text-primary mb-2 mx-auto" />
            <h3 className="font-medium text-foreground">Multiplayer</h3>
            <p className="text-sm text-muted">2-8 players per table</p>
          </div>
          <div className="p-4 bg-card border border-border">
            <Coins className="w-8 h-8 text-primary mb-2 mx-auto" />
            <h3 className="font-medium text-foreground">OCT Betting</h3>
            <p className="text-sm text-muted">Real crypto stakes</p>
          </div>
          <div className="p-4 bg-card border border-border">
            <Shield className="w-8 h-8 text-primary mb-2 mx-auto" />
            <h3 className="font-medium text-foreground">Secure</h3>
            <p className="text-sm text-muted">OctWa wallet integration</p>
          </div>
        </div>

        {connected ? (
          <Link to="/lobby">
            <Button className="px-8 py-3 text-lg">
              Enter Lobby
            </Button>
          </Link>
        ) : (
          <p className="text-muted">
            Connect your wallet to start playing
          </p>
        )}
      </div>
    </div>
  );
}
