/*
# Create prediction market core tables

## 1. Summary
Creates the tables needed for a sign-in prediction market: user profiles with a token balance and role, markets, each user's share holdings per market, a transaction history, and a log of token grants made by the manager.

## 2. New tables
- `profiles`: one row per signed-in user. Holds email, role ("user" or "admin") and token balance. Created automatically when someone signs up.
- `markets`: prediction markets with a question, the LMSR liquidity parameter, outstanding YES/NO quantities, and resolution status.
- `shares`: how many YES and NO contracts each user holds in each market.
- `transactions`: history of purchases made by users.
- `token_grants`: audit log of tokens the manager assigned to users.

## 3. Security
- Row level security enabled on every table.
- Users can read only their own profile, shares, transactions and token grants.
- The manager (role "admin") can read all profiles and all token grants.
- Every signed-in user can read markets. Nobody can write to markets, profiles or shares directly; writes happen only through protected database functions added in a later migration.
- Users cannot change their own role or token balance, because the table grants do not allow it.

## 4. Important notes
1. Migration is idempotent: safe to run again.
2. No data is deleted or altered.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  token_balance numeric(14,4) NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  q_yes numeric(14,4) NOT NULL DEFAULT 0,
  q_no numeric(14,4) NOT NULL DEFAULT 0,
  b numeric(14,4) NOT NULL CHECK (b > 0),
  resolved boolean NOT NULL DEFAULT false,
  outcome text CHECK (outcome IN ('YES', 'NO')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  yes_count numeric(14,4) NOT NULL DEFAULT 0 CHECK (yes_count >= 0),
  no_count numeric(14,4) NOT NULL DEFAULT 0 CHECK (no_count >= 0),
  UNIQUE (user_id, market_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('BUY_YES', 'BUY_NO')),
  amount numeric(14,4) NOT NULL,
  cost numeric(14,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS token_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,4) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shares_market_id_idx ON shares(market_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_market_id_idx ON transactions(market_id);
CREATE INDEX IF NOT EXISTS token_grants_user_id_idx ON token_grants(user_id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_grants ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON markets TO authenticated;
GRANT SELECT ON shares TO authenticated;
GRANT SELECT ON transactions TO authenticated;
GRANT SELECT ON token_grants TO authenticated;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_markets" ON markets;
CREATE POLICY "select_markets" ON markets FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "select_own_shares" ON shares;
CREATE POLICY "select_own_shares" ON shares FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_or_admin_token_grants" ON token_grants;
CREATE POLICY "select_own_or_admin_token_grants" ON token_grants FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
