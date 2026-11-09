/*
# Add protected buy and token grant functions

## 1. Summary
Adds the two actions the app needs and performs them on the server, so a user cannot change prices, balances or holdings by hand:
- `buy_shares`: a signed-in user buys YES or NO contracts on an open market. The cost is calculated with the LMSR formula, deducted from the user's tokens, and the market, holdings and history are updated together.
- `admin_grant_tokens`: the manager adds tokens to a user's balance and the grant is recorded.

## 2. New functions
- `lmsr_cost(q_yes, q_no, b)`: LMSR cost function, written in a numerically stable form.
- `buy_shares(market_id, side, amount)`: returns the updated market, the cost paid and the new balance.
- `admin_grant_tokens(user_id, amount)`: returns the user's new balance.

## 3. Security
- Both public actions check the caller. `buy_shares` requires a signed-in user. `admin_grant_tokens` requires the "admin" role.
- Execute permission is removed from the public and anonymous roles; only signed-in users can run these functions.
- Markets are locked while a purchase runs, so two buyers cannot overwrite each other's prices.

## 4. Important notes
1. Migration is idempotent: safe to run again.
2. No data is deleted or altered.
*/

CREATE OR REPLACE FUNCTION lmsr_cost(q_yes numeric, q_no numeric, b numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m numeric := GREATEST(q_yes, q_no);
BEGIN
  RETURN m + b * LN(EXP((q_yes - m) / b) + EXP((q_no - m) / b));
END;
$$;

CREATE OR REPLACE FUNCTION buy_shares(p_market_id uuid, p_side text, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_market markets%ROWTYPE;
  v_balance numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_cost numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Devi effettuare l''accesso per partecipare';
  END IF;
  IF p_side NOT IN ('YES', 'NO') THEN
    RAISE EXCEPTION 'Scelta non valida';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Quantita non valida';
  END IF;

  SELECT * INTO v_market FROM markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercato non trovato';
  END IF;
  IF v_market.resolved THEN
    RAISE EXCEPTION 'Questo mercato e gia chiuso';
  END IF;

  SELECT token_balance INTO v_balance FROM profiles WHERE id = v_uid FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profilo non trovato';
  END IF;

  IF p_side = 'YES' THEN
    v_new_q_yes := v_market.q_yes + p_amount;
    v_new_q_no := v_market.q_no;
  ELSE
    v_new_q_yes := v_market.q_yes;
    v_new_q_no := v_market.q_no + p_amount;
  END IF;

  v_cost := lmsr_cost(v_new_q_yes, v_new_q_no, v_market.b)
          - lmsr_cost(v_market.q_yes, v_market.q_no, v_market.b);

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Gettoni insufficienti: servono %, ne hai %', ROUND(v_cost, 2), ROUND(v_balance, 2);
  END IF;

  UPDATE profiles SET token_balance = token_balance - v_cost WHERE id = v_uid;

  UPDATE markets SET q_yes = v_new_q_yes, q_no = v_new_q_no
  WHERE id = p_market_id
  RETURNING * INTO v_market;

  INSERT INTO shares (user_id, market_id, yes_count, no_count)
  VALUES (
    v_uid,
    p_market_id,
    CASE WHEN p_side = 'YES' THEN p_amount ELSE 0 END,
    CASE WHEN p_side = 'NO' THEN p_amount ELSE 0 END
  )
  ON CONFLICT (user_id, market_id) DO UPDATE SET
    yes_count = shares.yes_count + EXCLUDED.yes_count,
    no_count = shares.no_count + EXCLUDED.no_count;

  INSERT INTO transactions (user_id, market_id, type, amount, cost)
  VALUES (v_uid, p_market_id, 'BUY_' || p_side, p_amount, v_cost);

  RETURN json_build_object(
    'market', to_json(v_market),
    'cost', v_cost,
    'balance', v_balance - v_cost
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_grant_tokens(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Operazione riservata al gestore';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Importo non valido';
  END IF;

  UPDATE profiles
  SET token_balance = token_balance + p_amount
  WHERE id = p_user_id
  RETURNING token_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utente non trovato';
  END IF;

  INSERT INTO token_grants (user_id, granted_by, amount)
  VALUES (p_user_id, auth.uid(), p_amount);

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION lmsr_cost(numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION buy_shares(uuid, text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_grant_tokens(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION buy_shares(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_grant_tokens(uuid, numeric) TO authenticated;
