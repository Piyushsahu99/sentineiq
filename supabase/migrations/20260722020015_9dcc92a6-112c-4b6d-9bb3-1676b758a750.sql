ALTER TABLE public.ai_investigations
  ADD COLUMN IF NOT EXISTS risk_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS timeline jsonb,
  ADD COLUMN IF NOT EXISTS band text;