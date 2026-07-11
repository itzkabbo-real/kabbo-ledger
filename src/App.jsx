import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useShopData } from './hooks/useShopData.js';
import Nav from './components/Nav.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Stock from './pages/Stock.jsx';
import POS from './pages/POS.jsx';
import Dues from './pages/Dues.jsx';
import Ledger from './pages/Ledger.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const auth = useAuth();
  const shopData = useShopData();
  const [tab, setTab] = useState('dashboard');

  if (auth.authLoading) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!auth.user || !auth.isConfigured) {
    return <Login auth={auth} />;
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h2>Kabbo Digital Ledger</h2>
          <span className="muted small">
            {auth.displayName} &middot; {auth.role}
            {auth.phone ? ` &middot; ${auth.phone}` : ''}
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={auth.logout}>
          Sign out
        </button>
      </header>

      <main className="main-content">
        {tab === 'dashboard' && <Dashboard shopData={shopData} online={auth.online} />}
        {tab === 'pos' && <POS stock={shopData.stock} customers={shopData.customers} actorName={auth.displayName} />}
        {tab === 'stock' && <Stock stock={shopData.stock} actorName={auth.displayName} />}
        {tab === 'dues' && <Dues dues={shopData.dues} customers={shopData.customers} actorName={auth.displayName} />}
        {tab === 'ledger' && <Ledger ledger={shopData.ledger} actorName={auth.displayName} />}
        {tab === 'reports' && (
          <Reports
            stock={shopData.stock}
            sales={shopData.sales}
            dues={shopData.dues}
            ledger={shopData.ledger}
            stockById={shopData.stockById}
          />
        )}
        {tab === 'settings' && <Settings user={auth.user} role={auth.role} />}
      </main>

      <Nav active={tab} onChange={setTab} role={auth.role} />
    </div>
  );
}
