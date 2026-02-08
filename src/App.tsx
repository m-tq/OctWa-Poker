import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Home } from "@/pages/Home";
import { Lobby } from "@/pages/Lobby";
import { Table } from "@/pages/Table";
import { Dashboard } from "@/pages/Dashboard";
import { Tournaments } from "@/pages/Tournaments";
import { TournamentDetail } from "@/pages/TournamentDetail";
import { UsernameSetupDialog } from "@/components/user/UsernameSetupDialog";

function App() {
  // Force dark mode for PokerNow-style experience
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <Layout>
      <Routes>
        {/* Core pages */}
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/table/:tableId" element={<Table />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Tournament routes */}
        <Route path="/tournaments" element={<Tournaments />} />
        <Route
          path="/tournament/:tournamentId"
          element={<TournamentDetail />}
        />

        {/* Catch-all: redirect to home */}
        <Route path="*" element={<Home />} />
      </Routes>
      <UsernameSetupDialog />
    </Layout>
  );
}

export default App;
