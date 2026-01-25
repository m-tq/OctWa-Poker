import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Home } from '@/pages/Home';
import { Lobby } from '@/pages/Lobby';
import { Table } from '@/pages/Table';
import { Dashboard } from '@/pages/Dashboard';
import { UsernameSetupDialog } from '@/components/user/UsernameSetupDialog';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/table/:tableId" element={<Table />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
      <UsernameSetupDialog />
    </Layout>
  );
}

export default App;
