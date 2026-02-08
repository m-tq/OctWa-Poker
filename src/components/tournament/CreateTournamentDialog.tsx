import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2, Info } from "lucide-react";
import type { TournamentStructure, BlindLevel } from "@/types/game";

interface CreateTournamentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    structure: TournamentStructure;
    maxParticipants: number;
  }) => void;
}

const DEFAULT_BLIND_LEVELS: BlindLevel[] = [
  { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, durationMinutes: 15 },
  { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, durationMinutes: 15 },
  { level: 3, smallBlind: 25, bigBlind: 50, ante: 5, durationMinutes: 15 },
  { level: 4, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 15 },
  { level: 5, smallBlind: 75, bigBlind: 150, ante: 15, durationMinutes: 15 },
  { level: 6, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 15 },
  { level: 7, smallBlind: 150, bigBlind: 300, ante: 30, durationMinutes: 15 },
  { level: 8, smallBlind: 200, bigBlind: 400, ante: 50, durationMinutes: 15 },
];

type Tab = "general" | "blinds" | "settings";

export function CreateTournamentDialog({
  open,
  onClose,
  onCreate,
}: CreateTournamentDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // General
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(16);
  const [buyInAmount, setBuyInAmount] = useState(10);
  const [startingStack, setStartingStack] = useState(1500);

  // Blinds
  const [blindLevels, setBlindLevels] =
    useState<BlindLevel[]>(DEFAULT_BLIND_LEVELS);
  const [blindLevelDuration, setBlindLevelDuration] = useState(15);

  // Settings
  const [maxPlayersPerTable, setMaxPlayersPerTable] = useState(8);
  const [minPlayersPerTable, setMinPlayersPerTable] = useState(3);
  const [allowReentry, setAllowReentry] = useState(false);
  const [maxReentries, setMaxReentries] = useState(1);
  const [reentryDeadlineLevel, setReentryDeadlineLevel] = useState(4);
  const [lateRegistrationLevels, setLateRegistrationLevels] = useState(3);
  const [breakAfterLevels, setBreakAfterLevels] = useState(4);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(5);
  const [handTimeoutSeconds, setHandTimeoutSeconds] = useState(30);
  const [payoutPercentages, setPayoutPercentages] = useState("50,30,20");

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Tournament name is required";
    if (maxParticipants < 4)
      newErrors.maxParticipants = "At least 4 participants required";
    if (maxParticipants > 100)
      newErrors.maxParticipants = "Maximum 100 participants";
    if (buyInAmount <= 0) newErrors.buyInAmount = "Buy-in must be positive";
    if (startingStack < 100)
      newErrors.startingStack = "Starting stack must be at least 100";
    if (blindLevels.length < 2)
      newErrors.blindLevels = "At least 2 blind levels required";
    if (maxPlayersPerTable < 2 || maxPlayersPerTable > 10)
      newErrors.maxPlayersPerTable = "Between 2–10 players per table";

    const payouts = payoutPercentages
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    if (payouts.length === 0)
      newErrors.payoutPercentages = "Enter at least one payout percentage";
    const totalPayout = payouts.reduce((a, b) => a + b, 0);
    if (Math.abs(totalPayout - 100) > 0.01)
      newErrors.payoutPercentages = `Payouts must total 100% (currently ${totalPayout}%)`;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payouts = payoutPercentages
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    const structure: TournamentStructure = {
      startingStack,
      blindLevels,
      blindLevelDurationMinutes: blindLevelDuration,
      breakAfterLevels,
      breakDurationMinutes,
      maxPlayersPerTable,
      minPlayersPerTable,
      lateRegistrationLevels,
      allowReentry,
      maxReentries: allowReentry ? maxReentries : 0,
      reentryDeadlineLevel: allowReentry ? reentryDeadlineLevel : 0,
      payoutPercentages: payouts,
      buyInAmount,
      handTimeoutSeconds,
    };

    onCreate({ name: name.trim(), structure, maxParticipants });

    // Reset
    setName("");
    setActiveTab("general");
    setErrors({});
    onClose();
  };

  const addBlindLevel = () => {
    const last = blindLevels[blindLevels.length - 1];
    const newLevel: BlindLevel = {
      level: last ? last.level + 1 : 1,
      smallBlind: last ? last.smallBlind * 2 : 10,
      bigBlind: last ? last.bigBlind * 2 : 20,
      ante: last ? Math.round(last.ante * 1.5) : 0,
      durationMinutes: blindLevelDuration,
    };
    setBlindLevels([...blindLevels, newLevel]);
  };

  const removeBlindLevel = (index: number) => {
    if (blindLevels.length <= 2) return;
    const updated = blindLevels
      .filter((_, i) => i !== index)
      .map((bl, i) => ({ ...bl, level: i + 1 }));
    setBlindLevels(updated);
  };

  const updateBlindLevel = (
    index: number,
    field: keyof BlindLevel,
    value: number,
  ) => {
    const updated = [...blindLevels];
    updated[index] = { ...updated[index], [field]: value };
    setBlindLevels(updated);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "blinds", label: "Blind Structure" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Tournament"
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit}>
        {/* Tab bar */}
        <div className="flex border-b border-border -mx-4 -mt-1 px-4 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors relative ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-4 animate-fade-in">
            <Input
              label="Tournament Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunday MTT Championship"
              error={errors.name}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Max Participants"
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                min={4}
                max={100}
                error={errors.maxParticipants}
              />
              <Input
                label="Buy-in (OCT)"
                type="number"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(Number(e.target.value))}
                min={0.01}
                step={0.01}
                error={errors.buyInAmount}
              />
            </div>

            <Input
              label="Starting Stack"
              type="number"
              value={startingStack}
              onChange={(e) => setStartingStack(Number(e.target.value))}
              min={100}
              step={100}
              error={errors.startingStack}
            />

            <div className="bg-secondary/50 border border-border p-3">
              <div className="flex items-start gap-2 text-xs text-muted">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Prize pool = Buy-in x Participants. Payouts are distributed to
                  top finishers based on payout structure in Settings.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Blinds Tab */}
        {activeTab === "blinds" && (
          <div className="space-y-4 animate-fade-in">
            <Input
              label="Level Duration (minutes)"
              type="number"
              value={blindLevelDuration}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBlindLevelDuration(val);
                setBlindLevels(
                  blindLevels.map((bl) => ({ ...bl, durationMinutes: val })),
                );
              }}
              min={1}
              max={60}
            />

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Blind Levels
              </label>
              {errors.blindLevels && (
                <span className="text-xs text-destructive mb-2 block">
                  {errors.blindLevels}
                </span>
              )}

              <div className="border border-border max-h-[240px] overflow-y-auto">
                {/* Header */}
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-1 px-2 py-1.5 bg-secondary/50 text-xs text-muted font-medium uppercase tracking-wider sticky top-0">
                  <span>Lvl</span>
                  <span>SB</span>
                  <span>BB</span>
                  <span>Ante</span>
                  <span></span>
                </div>

                {blindLevels.map((bl, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-1 px-2 py-1 border-t border-border items-center text-sm"
                  >
                    <span className="text-xs text-muted font-mono">
                      {bl.level}
                    </span>
                    <input
                      type="number"
                      value={bl.smallBlind}
                      onChange={(e) =>
                        updateBlindLevel(
                          i,
                          "smallBlind",
                          Number(e.target.value),
                        )
                      }
                      className="w-full px-1.5 py-0.5 text-xs font-mono bg-background border border-border text-foreground"
                      min={1}
                    />
                    <input
                      type="number"
                      value={bl.bigBlind}
                      onChange={(e) =>
                        updateBlindLevel(i, "bigBlind", Number(e.target.value))
                      }
                      className="w-full px-1.5 py-0.5 text-xs font-mono bg-background border border-border text-foreground"
                      min={1}
                    />
                    <input
                      type="number"
                      value={bl.ante}
                      onChange={(e) =>
                        updateBlindLevel(i, "ante", Number(e.target.value))
                      }
                      className="w-full px-1.5 py-0.5 text-xs font-mono bg-background border border-border text-foreground"
                      min={0}
                    />
                    <button
                      type="button"
                      onClick={() => removeBlindLevel(i)}
                      className="p-0.5 text-muted hover:text-destructive transition-colors disabled:opacity-30"
                      disabled={blindLevels.length <= 2}
                      title="Remove level"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addBlindLevel}
                className="mt-2 w-full"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Level
              </Button>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Max Players / Table"
                type="number"
                value={maxPlayersPerTable}
                onChange={(e) => setMaxPlayersPerTable(Number(e.target.value))}
                min={2}
                max={10}
                error={errors.maxPlayersPerTable}
              />
              <Input
                label="Min Players / Table"
                type="number"
                value={minPlayersPerTable}
                onChange={(e) => setMinPlayersPerTable(Number(e.target.value))}
                min={2}
                max={maxPlayersPerTable}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Late Registration (levels)"
                type="number"
                value={lateRegistrationLevels}
                onChange={(e) =>
                  setLateRegistrationLevels(Number(e.target.value))
                }
                min={0}
                max={blindLevels.length}
              />
              <Input
                label="Hand Timeout (sec)"
                type="number"
                value={handTimeoutSeconds}
                onChange={(e) => setHandTimeoutSeconds(Number(e.target.value))}
                min={10}
                max={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Break After (levels)"
                type="number"
                value={breakAfterLevels}
                onChange={(e) => setBreakAfterLevels(Number(e.target.value))}
                min={0}
                max={20}
              />
              <Input
                label="Break Duration (min)"
                type="number"
                value={breakDurationMinutes}
                onChange={(e) =>
                  setBreakDurationMinutes(Number(e.target.value))
                }
                min={1}
                max={30}
              />
            </div>

            {/* Re-entry */}
            <div className="border border-border p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowReentry}
                  onChange={(e) => setAllowReentry(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm font-medium text-foreground">
                  Allow Re-entry
                </span>
              </label>

              {allowReentry && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <Input
                    label="Max Re-entries"
                    type="number"
                    value={maxReentries}
                    onChange={(e) => setMaxReentries(Number(e.target.value))}
                    min={1}
                    max={5}
                  />
                  <Input
                    label="Re-entry Deadline (level)"
                    type="number"
                    value={reentryDeadlineLevel}
                    onChange={(e) =>
                      setReentryDeadlineLevel(Number(e.target.value))
                    }
                    min={1}
                    max={blindLevels.length}
                  />
                </div>
              )}
            </div>

            {/* Payout structure */}
            <div>
              <Input
                label="Payout Structure (%)"
                value={payoutPercentages}
                onChange={(e) => setPayoutPercentages(e.target.value)}
                placeholder="50, 30, 20"
                error={errors.payoutPercentages}
              />
              <p className="text-xs text-muted mt-1">
                Comma-separated percentages for 1st, 2nd, 3rd, etc. Must total
                100%.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 pt-4 mt-4 border-t border-border">
          <div className="text-xs text-muted">
            {activeTab === "general" && "Step 1 of 3"}
            {activeTab === "blinds" && "Step 2 of 3"}
            {activeTab === "settings" && "Step 3 of 3"}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {activeTab !== "settings" ? (
              <Button
                type="button"
                onClick={() => {
                  if (activeTab === "general") setActiveTab("blinds");
                  else if (activeTab === "blinds") setActiveTab("settings");
                }}
              >
                Next
              </Button>
            ) : (
              <Button type="submit">Create Tournament</Button>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
