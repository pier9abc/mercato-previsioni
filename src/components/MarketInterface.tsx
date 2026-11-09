import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { yesProbability } from '../lib/market';
import type { Market, Side } from '../lib/types';

const SHARE_AMOUNT = 10;

interface BuyResult {
  market: Market;
  cost: number;
}

interface MarketInterfaceProps {
  market: Market;
  onTraded: () => void;
}

export default function MarketInterface({ market, onTraded }: MarketInterfaceProps) {
  const [submittingSide, setSubmittingSide] = useState<Side | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pYes = yesProbability(market) * 100;
  const pNo = 100 - pYes;

  const handleBuy = async (side: Side) => {
    setSubmittingSide(side);
    setMessage(null);

    const { data, error } = await supabase.rpc('buy_shares', {
      p_market_id: market.id,
      p_side: side,
      p_amount: SHARE_AMOUNT,
    });

    setSubmittingSide(null);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    const result = data as BuyResult | null;
    if (!result || typeof result.cost !== 'number') {
      setMessage({ type: 'error', text: 'Risposta inattesa dal server. Riprova.' });
      return;
    }

    setMessage({
      type: 'success',
      text: `Hai acquistato ${SHARE_AMOUNT} quote ${side === 'YES' ? 'SI' : 'NO'} per ${result.cost.toFixed(2)} gettoni.`,
    });
    onTraded();
  };

  return (
    <article className="market-card">
      <header>
        <h2>{market.title}</h2>
        {market.description && <p className="muted">{market.description}</p>}
      </header>

      <div className="odds">
        <div>
          <span className="odds-label yes">SI</span>
          <strong>{pYes.toFixed(1)}%</strong>
        </div>
        <div className="odds-right">
          <span className="odds-label no">NO</span>
          <strong>{pNo.toFixed(1)}%</strong>
        </div>
      </div>
      <div className="odds-bar" aria-hidden="true">
        <span style={{ width: `${pYes}%` }} />
      </div>

      {market.resolved ? (
        <p className="muted">
          Mercato chiuso{market.outcome ? `: esito ${market.outcome === 'YES' ? 'SI' : 'NO'}` : ''}.
        </p>
      ) : (
        <div className="bet-buttons">
          <button
            type="button"
            className="bet yes"
            onClick={() => handleBuy('YES')}
            disabled={submittingSide !== null}
          >
            {submittingSide === 'YES' ? 'Acquisto in corso…' : 'Scommetti SI'}
          </button>
          <button
            type="button"
            className="bet no"
            onClick={() => handleBuy('NO')}
            disabled={submittingSide !== null}
          >
            {submittingSide === 'NO' ? 'Acquisto in corso…' : 'Scommetti NO'}
          </button>
        </div>
      )}

      {message && (
        <p className={`message ${message.type}`} role="status">
          {message.text}
        </p>
      )}
    </article>
  );
}
