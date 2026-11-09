import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, email, role, token_balance')
      .eq('id', userId)
      .maybeSingle();

    if (queryError) {
      setError('Non riesco a caricare il tuo profilo. Riprova.');
      return;
    }
    if (!data) {
      setError('Profilo non ancora pronto. Ricarica la pagina tra qualche secondo.');
      return;
    }
    setError(null);
    setProfile(data as Profile);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, error, refresh };
}
