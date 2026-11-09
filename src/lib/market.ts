import type { Market } from './types';

export function yesProbability(market: Pick<Market, 'q_yes' | 'q_no' | 'b'>): number {
  return 1 / (1 + Math.exp((market.q_no - market.q_yes) / market.b));
}
