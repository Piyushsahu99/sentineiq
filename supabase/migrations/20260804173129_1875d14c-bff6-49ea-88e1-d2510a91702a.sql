CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  parent_version text,
  status text NOT NULL DEFAULT 'candidate',
  trigger text NOT NULL DEFAULT 'manual',
  drift_report_id uuid REFERENCES public.model_drift_reports(id) ON DELETE SET NULL,
  sample_size integer NOT NULL DEFAULT 0,
  positive_labels integer NOT NULL DEFAULT 0,
  holdout_size integer NOT NULL DEFAULT 0,
  calibration jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_weights jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  gate jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  activated_at timestamp with time zone,
  retired_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX model_versions_single_active ON public.model_versions (status) WHERE status = 'active';
CREATE INDEX model_versions_created_at_idx ON public.model_versions (created_at DESC);

GRANT SELECT ON public.model_versions TO authenticated;
GRANT ALL ON public.model_versions TO service_role;

ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analysts can view model versions"
ON public.model_versions FOR SELECT TO authenticated
USING (public.is_analyst(auth.uid()));

ALTER TABLE public.model_drift_reports ADD COLUMN IF NOT EXISTS retrain_version text;