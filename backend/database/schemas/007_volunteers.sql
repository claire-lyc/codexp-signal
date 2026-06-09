CREATE SCHEMA IF NOT EXISTS volunteer;

DO $$
BEGIN
  CREATE TYPE volunteer.opportunity_status AS ENUM ('open', 'paused', 'full', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE volunteer.assignment_status AS ENUM ('applied', 'offered', 'accepted', 'declined', 'checked_in', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE volunteer.notification_status AS ENUM ('sent', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS volunteer.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  preferred_region TEXT NOT NULL,
  availability TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  certification_notes TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  verification_status public.verification_status NOT NULL DEFAULT 'needs_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteer.profile_skills (
  profile_id UUID NOT NULL REFERENCES volunteer.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  verification_status public.verification_status NOT NULL DEFAULT 'needs_review',
  evidence_notes TEXT NOT NULL DEFAULT '',
  verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, skill)
);

CREATE TABLE IF NOT EXISTS volunteer.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES auth.government_agencies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  location_text TEXT NOT NULL,
  region TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('high', 'medium', 'low')),
  shift_label TEXT NOT NULL,
  reporting_point TEXT NOT NULL,
  description TEXT NOT NULL,
  status volunteer.opportunity_status NOT NULL DEFAULT 'open',
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteer.opportunity_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES volunteer.opportunities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  needed_count INTEGER NOT NULL CHECK (needed_count > 0),
  special_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteer.role_required_skills (
  role_id UUID NOT NULL REFERENCES volunteer.opportunity_roles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  PRIMARY KEY (role_id, skill)
);

CREATE TABLE IF NOT EXISTS volunteer.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES volunteer.profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES volunteer.opportunities(id) ON DELETE CASCADE,
  status volunteer.assignment_status NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS volunteer.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES volunteer.applications(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES volunteer.profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES volunteer.opportunities(id) ON DELETE CASCADE,
  role_id UUID REFERENCES volunteer.opportunity_roles(id) ON DELETE SET NULL,
  status volunteer.assignment_status NOT NULL DEFAULT 'offered',
  note TEXT NOT NULL DEFAULT '',
  offered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteer.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES volunteer.profiles(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES volunteer.opportunities(id) ON DELETE CASCADE,
  role_id UUID REFERENCES volunteer.opportunity_roles(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES auth.government_agencies(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status volunteer.notification_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS volunteer_profiles_status_idx ON volunteer.profiles (verification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_profiles_region_idx ON volunteer.profiles (preferred_region);
CREATE INDEX IF NOT EXISTS volunteer_profile_skills_skill_idx ON volunteer.profile_skills (skill, verification_status);
CREATE INDEX IF NOT EXISTS volunteer_opportunities_agency_status_idx ON volunteer.opportunities (agency_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_applications_profile_idx ON volunteer.applications (profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_applications_opportunity_idx ON volunteer.applications (opportunity_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_assignments_profile_idx ON volunteer.assignments (profile_id, status, offered_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_assignments_opportunity_idx ON volunteer.assignments (opportunity_id, status, offered_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_notifications_profile_idx ON volunteer.notifications (profile_id, status, created_at DESC);
