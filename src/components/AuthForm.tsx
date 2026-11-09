import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup';

const FRIENDLY_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Email o password non corrette.',
  'User already registered': 'Esiste già un account con questa email.',
  'Password is known to be weak and easy to guess, please choose a different one.':
    'Questa password è troppo comune e facile da indovinare. Scegline una più robusta, con lettere, numeri e simboli.',
};

const GENERIC_ERROR = 'Non è stato possibile completare l’operazione. Riprova.';

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const switchMode = () => {
    setMode(isSignup ? 'signin' : 'signup');
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const credentials = { email: email.trim(), password };
    const { data, error: authError } = isSignup
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);

    setSubmitting(false);

    if (authError) {
      setError(FRIENDLY_ERRORS[authError.message] ?? GENERIC_ERROR);
      return;
    }
    if (isSignup && !data.session) {
      setNotice('Account creato. Ora accedi con la tua email e password.');
      setMode('signin');
      setPassword('');
    }
  };

  return (
    <div className="auth-card">
      <h1>{isSignup ? 'Crea il tuo account' : 'Accedi'}</h1>
      <p className="muted">
        {isSignup
          ? 'Registrati per partecipare ai mercati con i gettoni assegnati dal gestore.'
          : 'Inserisci le tue credenziali per continuare.'}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message success" role="status">{notice}</p>}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Attendi…' : isSignup ? 'Crea account' : 'Accedi'}
        </button>
      </form>

      <button type="button" className="link-button" onClick={switchMode}>
        {isSignup ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
      </button>
    </div>
  );
}
