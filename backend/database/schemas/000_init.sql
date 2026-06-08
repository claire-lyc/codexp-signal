CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS citizen;
CREATE SCHEMA IF NOT EXISTS dashboard;
CREATE SCHEMA IF NOT EXISTS audit;

DO $$
BEGIN
  CREATE TYPE public.actor_type AS ENUM (
    'anonymous_citizen',
    'citizen',
    'government_user',
    'system',
    'external_api'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.crisis_type AS ENUM (
    'health',
    'weather',
    'supply_chain',
    'infrastructure',
    'cybersecurity',
    'public_sentiment',
    'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.severity_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.verification_status AS ENUM (
    'unverified',
    'needs_review',
    'partially_verified',
    'verified',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
