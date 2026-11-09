import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface AdminTokensProps {
  onGranted: () => void;
}

export default function AdminTokens({ onGranted }: AdminTokensProps) {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, token_balance')
      .order('email', { ascending: true });

    if (error) {
      setLoadError('Non riesco a caricare l’elenco degli utenti. Riprova.');
      return;
    }
    setLoadError(null);
    setUsers((data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    const selected = users?.find((user) => user.id === userId);

    if (!selected || !Number.isFinite(value) || value <= 0) {
      setMessage({ type: 'error', text: 'Scegli un utente e inserisci un importo maggiore di zero.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_grant_tokens', {
      p_user_id: selected.id,
      p_amount: value,
    });
    setSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    setMessage({ type: 'success', text: `Gettoni assegnati a ${selected.email}.` });
    setAmount('');
    loadUsers();
    onGranted();
  };

  if (loadError) return <p className="message error">{loadError}</p>;
  if (!users) return <p className="muted">Caricamento degli utenti…</p>;

  return (
    <section className="admin-panel">
      <h2>Assegna gettoni</h2>
      <p className="muted">Scegli un utente e l’importo da aggiungere al suo saldo.</p>

      <form className="grant-form" onSubmit={handleGrant}>
        <label className="field">
          <span>Utente</span>
          <select value={userId} onChange={(event) => setUserId(event.target.value)} required>
            <option value="" disabled>Seleziona un utente</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.email}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Gettoni da assegnare</span>
          <input
            type="number"
            min="0"
            step="any"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Assegnazione…' : 'Assegna'}
        </button>
      </form>

      {message && <p className={`message ${message.type}`} role="status">{message.text}</p>}

      <h3>Utenti e saldi</h3>
      <ul className="user-list">
        {users.map((user) => (
          <li key={user.id}>
            <span>{user.email}</span>
            <span className="muted">{user.role === 'admin' ? 'Gestore' : 'Utente'}</span>
            <strong>{user.token_balance.toFixed(2)} gettoni</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
