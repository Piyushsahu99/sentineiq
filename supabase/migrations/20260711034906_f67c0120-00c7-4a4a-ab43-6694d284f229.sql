
-- 1. profiles: region/bank/currency preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS bank text NOT NULL DEFAULT 'HDFC Bank',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

-- Backfill any pre-existing null-shaped rows (defensive)
UPDATE public.profiles SET region = COALESCE(region,'IN'),
  bank = COALESCE(bank,'HDFC Bank'),
  currency = COALESCE(currency,'INR');

-- Owner update policy (owner-only select policy already exists)
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
CREATE POLICY "profiles_owner_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. tx_check_history
CREATE TABLE IF NOT EXISTS public.tx_check_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_id uuid,
  verdict text NOT NULL,
  risk_score integer,
  signals jsonb DEFAULT '[]'::jsonb,
  currency text DEFAULT 'INR',
  amount_local numeric,
  merchant text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tx_check_history TO authenticated;
GRANT ALL ON public.tx_check_history TO service_role;

ALTER TABLE public.tx_check_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_check_history_owner_read" ON public.tx_check_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_analyst(auth.uid()));

CREATE INDEX IF NOT EXISTS tx_check_history_user_created_idx
  ON public.tx_check_history (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tx_check_history;
