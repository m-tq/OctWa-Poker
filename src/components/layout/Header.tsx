import { Link, useLocation } from "react-router-dom";
import { Spade, User, Trophy } from "lucide-react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useStore } from "@/store";

export function Header() {
  const location = useLocation();
  const { connected, username } = useStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4">
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
        >
          <Spade className="w-6 h-6" />
          <span className="font-semibold text-lg">OctWa Poker</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            to="/lobby"
            className={`text-sm transition-colors ${
              location.pathname === "/lobby"
                ? "text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            Lobby
          </Link>
          <Link
            to="/tournaments"
            className={`text-sm transition-colors flex items-center gap-1 ${
              location.pathname.startsWith("/tournament")
                ? "text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Tournaments
          </Link>
          {connected && (
            <Link
              to="/dashboard"
              className={`text-sm transition-colors flex items-center gap-1 ${
                location.pathname === "/dashboard"
                  ? "text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <User className="w-4 h-4" />
              {username || "Dashboard"}
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <ConnectButton />
      </div>
    </header>
  );
}
