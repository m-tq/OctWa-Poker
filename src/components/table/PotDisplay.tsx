import { Coins } from 'lucide-react';

interface PotDisplayProps {
  pot: number;
  sidePots?: { amount: number }[];
}

export function PotDisplay({ pot, sidePots = [] }: PotDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 bg-black/50 px-4 py-2 border border-white/20">
        <Coins className="w-5 h-5 text-yellow-400" />
        <span className="text-white font-bold text-lg">
          {pot.toLocaleString()} OCT
        </span>
      </div>
      
      {sidePots.length > 0 && (
        <div className="flex gap-2">
          {sidePots.map((sidePot, index) => (
            <div 
              key={index}
              className="bg-black/30 px-2 py-1 text-xs text-white/80 border border-white/10"
            >
              Side Pot: {sidePot.amount.toLocaleString()} OCT
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
