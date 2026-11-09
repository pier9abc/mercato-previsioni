import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Side } from '../lib/types';

interface MarketSummary {
  title: string;
  resolved: boolean;
  outcome: Side | null;
}

interface Holding {
  market_id: string;
  yes_count: number;
  no_count: number;
  markets: MarketSummary | MarketSummary[] | null;
}

const LOAD_ERROR = 'Non riesco a caricare le tue puntate. Riprova.';

const pickMarket = (holding: Holding): MarketSummary | null =>
  Array.isArray(holding.markets) ? holding.markets[0] ?? null : holding.markets;

interface MyBetsPageProps {
  tokenBalance: number;
}

export default function MyBetsPage({ tokenBalance }: MyBetsPageProps) {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('shares')
      .select('market_id, yes_count, no_count, markets(title, resolved, outcome)')
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(LOAD_ERROR);
          return;
        }
        const rows = ((data ?? []) as Holding[]).filter(
          (row) => Number(row.yes_count) > 0 || Number(row.no_count) > 0,
        );
        setHoldings(rows);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <p className="balance-summary">
        Saldo: <strong>{tokenBalance.toFixed(2)} gettoni</strong>
      </p>
      {error && <p className="message error">{error}</p>}
      {!error && !holdings && <p className="muted">Caricamento delle puntate…</p>}
      {holdings && holdings.length === 0 && (
        <p className="muted">Non hai ancora fatto nessuna puntata.</p>
      )}
      {holdings && holdings.length > 0 && <HoldingsGrid holdings={holdings} />}
    </section>
  );
}

function HoldingsGrid({ holdings }: { holdings: Holding[] }) {
  return (
    <div className="markets-grid">
      {holdings.map((holding) => {
        const market = pickMarket(holding);
        return (
          <article key={holding.market_id} className="market-card">
            <header>
              <h2>{market?.title ?? 'Mercato'}</h2>
            </header>
            <p>
              Quote SI: <strong>{Number(holding.yes_count).toFixed(0)}</strong>
              {' · '}
              Quote NO: <strong>{Number(holding.no_count).toFixed(0)}</strong>
            </p>
            {market?.resolved && (
              <p className="muted">
                Mercato chiuso{market.outcome ? `: esito ${market.outcome === 'YES' ? 'SI' : 'NO'}` : ''}.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
