CREATE TABLE public.model_feature_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid,
  customer_id uuid,
  features jsonb NOT NULL,
  rf_probability numeric NOT NULL,
  composite integer,
  band text,
  model_version text NOT NULL DEFAULT 'rf-v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_feature_snapshots_created_at_idx ON public.model_feature_snapshots (created_at DESC);
GRANT SELECT ON public.model_feature_snapshots TO authenticated;
GRANT ALL ON public.model_feature_snapshots TO service_role;
ALTER TABLE public.model_feature_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots analyst read" ON public.model_feature_snapshots FOR SELECT TO authenticated USING (public.is_analyst(auth.uid()));

CREATE TABLE public.model_drift_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL DEFAULT 'rf-v1',
  window_start timestamptz,
  window_end timestamptz,
  sample_size integer NOT NULL DEFAULT 0,
  overall_psi numeric NOT NULL DEFAULT 0,
  prediction_psi numeric NOT NULL DEFAULT 0,
  drifted_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  feature_psi jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'stable',
  retrain_recommended boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_drift_reports_created_at_idx ON public.model_drift_reports (created_at DESC);
GRANT SELECT ON public.model_drift_reports TO authenticated;
GRANT ALL ON public.model_drift_reports TO service_role;
ALTER TABLE public.model_drift_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drift reports analyst read" ON public.model_drift_reports FOR SELECT TO authenticated USING (public.is_analyst(auth.uid()));