interface PotDisplayProps {
  pot: number;
  sidePots?: { amount: number; eligiblePlayerIds?: string[] }[];
}

export function PotDisplay({ pot, sidePots = [] }: PotDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Main pot — PokerNow-style green rounded pill */}
      <div
        className="
          flex items-center gap-2
          px-5 py-1.5
          rounded-full
          bg-gradient-to-b from-[#2a7a4a] to-[#1d5c36]
          border border-white/10
          shadow-lg shadow-black/30
          backdrop-blur-sm
          min-w-[80px] justify-center
        "
      >
        <span className="text-white font-bold text-base sm:text-lg tabular-nums drop-shadow-sm">
          {pot.toLocaleString()}
        </span>
      </div>

      {/* Side pots */}
      {sidePots.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center max-w-[400px]">
          {sidePots.map((sidePot, index) => (
            <div
              key={index}
              className="
                flex items-center gap-1.5
                px-3 py-1
                rounded-full
                bg-gradient-to-b from-[#3a3a3a] to-[#252525]
                border border-white/[0.08]
                shadow-md shadow-black/20
              "
              title={
                sidePot.eligiblePlayerIds
                  ? `Eligible: ${sidePot.eligiblePlayerIds.length} players`
                  : undefined
              }
            >
              {/* Small chip icon */}
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border border-yellow-300/40 flex-shrink-0 shadow-sm" />
              <span className="text-white/80 text-[11px] font-semibold tabular-nums">
                {sidePot.amount.toLocaleString()}
              </span>
              <span className="text-white/30 text-[9px] font-medium">
                Side {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
