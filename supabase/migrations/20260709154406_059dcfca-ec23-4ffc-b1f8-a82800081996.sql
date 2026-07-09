
-- Feedback + suppressions for false-positive reduction
CREATE TABLE IF NOT EXISTS public.analyst_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  investigation_id UUID REFERENCES public.ai_investigations(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('true_positive','false_positive','benign')),
  signal_id TEXT,
  notes TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyst_feedback TO authenticated;
GRANT ALL ON public.analyst_feedback TO service_role;
ALTER TABLE public.analyst_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysts read feedback" ON public.analyst_feedback FOR SELECT TO authenticated USING (public.is_analyst(auth.uid()));
CREATE POLICY "analysts write feedback" ON public.analyst_feedback FOR INSERT TO authenticated WITH CHECK (public.is_analyst(auth.uid()));

CREATE TABLE IF NOT EXISTS public.suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id TEXT NOT NULL,
  customer_id UUID,
  reason TEXT,
  weight_multiplier NUMERIC NOT NULL DEFAULT 0.2,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppressions TO authenticated;
GRANT ALL ON public.suppressions TO service_role;
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysts read supp" ON public.suppressions FOR SELECT TO authenticated USING (public.is_analyst(auth.uid()));
CREATE POLICY "analysts write supp" ON public.suppressions FOR INSERT TO authenticated WITH CHECK (public.is_analyst(auth.uid()));

-- Store typed explanation tree on investigations
ALTER TABLE public.ai_investigations
  ADD COLUMN IF NOT EXISTS explanation JSONB,
  ADD COLUMN IF NOT EXISTS calibrated_confidence NUMERIC;
