DO $$
BEGIN
  CREATE TYPE dashboard.source_kind AS ENUM (
    'official_api',
    'citizen_reports',
    'manual',
    'model_output'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dashboard.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  agency TEXT,
  source_kind dashboard.source_kind NOT NULL,
  url TEXT,
  refresh_interval_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard.data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES dashboard.data_sources(id),
  crisis_type public.crisis_type NOT NULL,
  snapshot_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, snapshot_key, captured_at)
);

CREATE INDEX IF NOT EXISTS data_snapshots_crisis_type_idx ON dashboard.data_snapshots (crisis_type, captured_at DESC);
CREATE INDEX IF NOT EXISTS data_snapshots_payload_gin_idx ON dashboard.data_snapshots USING GIN (payload);

CREATE TABLE IF NOT EXISTS dashboard.crises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crisis_type public.crisis_type NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'monitoring', 'resolved')),
  severity public.severity_level NOT NULL,
  summary TEXT,
  started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crises_status_idx ON dashboard.crises (status, severity);

CREATE TABLE IF NOT EXISTS dashboard.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_id UUID REFERENCES dashboard.crises(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  crisis_type public.crisis_type NOT NULL,
  severity public.severity_level NOT NULL,
  region TEXT,
  source_kind dashboard.source_kind NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'suppressed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alerts_status_idx ON dashboard.alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_crisis_type_region_idx ON dashboard.alerts (crisis_type, region);

CREATE TABLE IF NOT EXISTS dashboard.map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_key TEXT NOT NULL,
  crisis_id UUID REFERENCES dashboard.crises(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_layers_layer_key_idx ON dashboard.map_layers (layer_key, generated_at DESC);
