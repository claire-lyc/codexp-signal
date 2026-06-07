CREATE TYPE citizen.report_status AS ENUM (
  'submitted',
  'triage',
  'in_progress',
  'grouped',
  'resolved',
  'rejected'
);

CREATE TYPE citizen.image_processing_status AS ENUM (
  'uploaded',
  'queued',
  'processing',
  'processed',
  'failed',
  'rejected'
);

CREATE TABLE citizen.reports (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_created_at_idx ON citizen.reports (status, created_at DESC);
CREATE INDEX reports_crisis_type_idx ON citizen.reports (crisis_type);
CREATE INDEX reports_planning_area_idx ON citizen.reports (planning_area_id);

CREATE TABLE citizen.report_images (
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

CREATE INDEX report_images_report_id_idx ON citizen.report_images (report_id);
CREATE INDEX report_images_processing_status_idx ON citizen.report_images (processing_status);

CREATE TABLE citizen.report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES citizen.reports(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type public.actor_type NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_comments_report_id_idx ON citizen.report_comments (report_id, created_at);

CREATE TABLE citizen.report_agency_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES citizen.reports(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES auth.government_agencies(id),
  pinged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_agency_pings_report_id_idx ON citizen.report_agency_pings (report_id);

CREATE TABLE citizen.broadcasts (
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

CREATE INDEX broadcasts_status_created_at_idx ON citizen.broadcasts (status, created_at DESC);

