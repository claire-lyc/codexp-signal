CREATE TABLE IF NOT EXISTS audit.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type public.actor_type NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_created_at_idx ON audit.events (created_at DESC);
CREATE INDEX IF NOT EXISTS events_entity_idx ON audit.events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS events_event_type_idx ON audit.events (event_type);
CREATE INDEX IF NOT EXISTS events_metadata_gin_idx ON audit.events USING GIN (metadata);

CREATE TABLE IF NOT EXISTS audit.external_api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_api_calls_source_idx ON audit.external_api_calls (source_code, created_at DESC);
