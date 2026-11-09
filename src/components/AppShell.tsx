import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import MarketsPage from './MarketsPage';
import MyBetsPage from './MyBetsPage';
import AdminTokens from './AdminTokens';

type View = 'markets' | 'bets' | 'admin';

interface AppShellProps {
  userId: string;
  email: string;
}

export default function AppShell({ userId, email }: AppShellProps) {
  const { profile, error, refresh } = useProfile(userId);
  const [view, setView] = useState<View>('markets');

  const isAdmin = profile?.role === 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Mercato delle previsioni</span>
        <nav className="nav">
          <button
            type="button"
            className={`nav-link${view === 'markets' ? ' active' : ''}`}
            onClick={() => setView('markets')}
          >
            Mercati
          </button>
          <button
            type="button"
            className={`nav-link${view === 'bets' ? ' active' : ''}`}
            onClick={() => setView('bets')}
          >
            Le mie puntate
          </button>
          {isAdmin && (
            <button
              type="button"
              className={`nav-link${view === 'admin' ? ' active' : ''}`}
              onClick={() => setView('admin')}
            >
              Gestione gettoni
            </button>
          )}
        </nav>
        <div className="account">
          {profile && <span className="balance">{profile.token_balance.toFixed(2)} gettoni</span>}
          <span className="muted account-email">{email}</span>
          <button type="button" className="ghost" onClick={handleSignOut}>Esci</button>
        </div>
      </header>

      <main className="content">
        {error && <p className="message error">{error}</p>}
        {!profile && !error && <p className="muted">Caricamento…</p>}
        {profile && view === 'markets' && <MarketsPage onTraded={refresh} />}
        {profile && view === 'bets' && <MyBetsPage tokenBalance={profile.token_balance} />}
        {profile && isAdmin && view === 'admin' && <AdminTokens onGranted={refresh} />}
      </main>
    </div>
  );
}
