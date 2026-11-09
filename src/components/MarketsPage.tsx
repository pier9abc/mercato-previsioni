import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Market } from '../lib/types';
import MarketInterface from './MarketInterface';

interface MarketsPageProps {
  onTraded: () => void;
}

export default function MarketsPage({ onTraded }: MarketsPageProps) {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('markets')
      .select('id, title, description, q_yes, q_no, b, resolved, outcome')
      .order('created_at', { ascending: true });

    if (queryError) {
      setError('Non riesco a caricare i mercati. Riprova.');
      return;
    }
    setError(null);
    setMarkets((data ?? []) as Market[]);
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const handleTraded = () => {
    loadMarkets();
    onTraded();
  };

  if (error) return <p className="message error">{error}</p>;
  if (!markets) return <p className="muted">Caricamento dei mercati…</p>;
  if (markets.length === 0) return <p className="muted">Non ci sono ancora mercati aperti.</p>;

  return (
    <div className="markets-grid">
      {markets.map((market) => (
        <MarketInterface key={market.id} market={market} onTraded={handleTraded} />
      ))}
    </div>
  );
}
