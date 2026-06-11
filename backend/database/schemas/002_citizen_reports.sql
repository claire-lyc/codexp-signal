DO $$
BEGIN
  CREATE TYPE citizen.report_status AS ENUM (
    'submitted',
    'triage',
    'in_progress',
    'grouped',
    'resolved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE citizen.image_processing_status AS ENUM (
    'uploaded',
    'queued',
    'processing',
    'processed',
    'failed',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS citizen.report_ticket_seq START WITH 42;

CREATE TABLE IF NOT EXISTS citizen.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_report_id TEXT NOT NULL UNIQUE,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_label TEXT NOT NULL DEFAULT 'Citizen',
  crisis_type public.crisis_type NOT NULL,
  report_type TEXT NOT NULL,
  title TEXT,
  description TEXT NOT NULL,
  location_text TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  planning_area_id TEXT,
  severity public.severity_level NOT NULL DEFAULT 'medium',
  status citizen.report_status NOT NULL DEFAULT 'submitted',
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  confidence_score NUMERIC(5, 2),
  assigned_agency_id UUID REFERENCES auth.government_agencies(id),
  grouped_report_id UUID REFERENCES citizen.reports(id),
  chat_enabled BOOLEAN NOT NULL DEFAULT true,
  chat_closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS citizen.report_subject_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  description TEXT,
  verified_at TIMESTAMPTZ,
  verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS citizen.report_subject_tag_categories (
  subject_tag_id UUID NOT NULL REFERENCES citizen.report_subject_tags(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (subject_tag_id, category)
);

CREATE INDEX IF NOT EXISTS report_subject_tag_categories_category_idx
  ON citizen.report_subject_tag_categories (category);

CREATE INDEX IF NOT EXISTS reports_status_created_at_idx ON citizen.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_crisis_type_idx ON citizen.reports (crisis_type);
CREATE INDEX IF NOT EXISTS reports_planning_area_idx ON citizen.reports (planning_area_id);

ALTER TABLE citizen.reports
  ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subject_tag_id UUID REFERENCES citizen.report_subject_tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_work_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_work_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_handler_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reports_subject_tag_id_idx ON citizen.reports (subject_tag_id);
CREATE INDEX IF NOT EXISTS reports_started_work_by_user_id_idx ON citizen.reports (started_work_by_user_id);

WITH seed_tags(label, description, categories) AS (
  VALUES
    ('Covid-19', 'Respiratory illness, Covid-19 clusters, testing, or isolation support.', ARRAY['health']),
    ('Hospital crowding', 'Crowding or long wait reports at hospitals, clinics, or urgent care.', ARRAY['health']),
    ('Dengue symptoms', 'Dengue symptoms, clusters, mosquito activity, or health advisory requests.', ARRAY['health', 'environment']),
    ('Orchard Road flooding', 'Flooding or road disruption around Orchard Road.', ARRAY['flood', 'transport', 'infrastructure']),
    ('MRT disruption', 'Train delay, platform crowding, station disruption, or rail incident.', ARRAY['transport', 'infrastructure']),
    ('Medicine shortage', 'Medication stockouts or pharmacy supply shortage reports.', ARRAY['supply', 'health']),
    ('Flash flood', 'Fast-rising water, underpass flooding, or flood-prone roads.', ARRAY['flood', 'weather']),
    ('Road obstruction', 'Blocked roads, stalled vehicles, fallen trees, or unsafe road conditions.', ARRAY['transport', 'infrastructure']),
    ('Haze', 'Air quality, smoke haze, or outdoor exposure concerns.', ARRAY['environment', 'health']),
    ('Power outage', 'Electricity outage or critical utility interruption.', ARRAY['infrastructure']),
    ('Fire/smoke', 'Fire, smoke, burning smell, or evacuation concern.', ARRAY['infrastructure', 'environment']),
    ('Public safety', 'Police, crowd safety, suspicious activity, or general public risk.', ARRAY['other', 'infrastructure'])
)
INSERT INTO citizen.report_subject_tags (label, description)
SELECT label, description
FROM seed_tags
ON CONFLICT (label) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = now();

WITH seed_tags(label, categories) AS (
  VALUES
    ('Covid-19', ARRAY['health']),
    ('Hospital crowding', ARRAY['health']),
    ('Dengue symptoms', ARRAY['health', 'environment']),
    ('Orchard Road flooding', ARRAY['flood', 'transport', 'infrastructure']),
    ('MRT disruption', ARRAY['transport', 'infrastructure']),
    ('Medicine shortage', ARRAY['supply', 'health']),
    ('Flash flood', ARRAY['flood', 'weather']),
    ('Road obstruction', ARRAY['transport', 'infrastructure']),
    ('Haze', ARRAY['environment', 'health']),
    ('Power outage', ARRAY['infrastructure']),
    ('Fire/smoke', ARRAY['infrastructure', 'environment']),
    ('Public safety', ARRAY['other', 'infrastructure'])
)
INSERT INTO citizen.report_subject_tag_categories (subject_tag_id, category)
SELECT tags.id, category
FROM seed_tags
JOIN citizen.report_subject_tags tags ON tags.label = seed_tags.label
CROSS JOIN LATERAL unnest(seed_tags.categories) AS category
ON CONFLICT (subject_tag_id, category) DO NOTHING;

CREATE TABLE IF NOT EXISTS citizen.report_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES citizen.reports(id) ON DELETE CASCADE,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  checksum_sha256 TEXT,
  processing_status citizen.image_processing_status NOT NULL DEFAULT 'uploaded',
  processed_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS report_images_report_id_idx ON citizen.report_images (report_id);
CREATE INDEX IF NOT EXISTS report_images_processing_status_idx ON citizen.report_images (processing_status);

CREATE TABLE IF NOT EXISTS citizen.report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES citizen.reports(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type public.actor_type NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_comments_report_id_idx ON citizen.report_comments (report_id, created_at);

CREATE TABLE IF NOT EXISTS citizen.report_agency_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES citizen.reports(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES auth.government_agencies(id),
  pinged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_agency_pings_report_id_idx ON citizen.report_agency_pings (report_id);

CREATE TABLE IF NOT EXISTS citizen.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_report_id UUID REFERENCES citizen.reports(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity public.severity_level NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all_citizens', 'regions', 'agencies')),
  target_regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  target_agency_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  platforms TEXT[] NOT NULL DEFAULT ARRAY['web']::TEXT[],
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('draft', 'ongoing', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS broadcasts_status_created_at_idx ON citizen.broadcasts (status, created_at DESC);
