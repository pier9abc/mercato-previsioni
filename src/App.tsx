import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import AuthForm from './components/AuthForm';
import AppShell from './components/AppShell';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return <div className="centered muted">Caricamento…</div>;
  }

  if (!session) {
    return (
      <div className="centered">
        <AuthForm />
      </div>
    );
  }

  return <AppShell userId={session.user.id} email={session.user.email ?? ''} />;
}
