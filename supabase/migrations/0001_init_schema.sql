-- ============================================================
-- Outreach B2B — Schéma initial
-- Tables : profiles, user_integrations, contacts, segments,
--          templates, campaigns, messages_generated,
--          suppression_list, audit_logs
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----- ENUMS -----
DO $$ BEGIN
  CREATE TYPE linkedin_mode AS ENUM ('manual', 'unipile');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE integration_provider AS ENUM ('smtp', 'mistral', 'unipile', 'dropcontact', 'resend');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE template_channel AS ENUM ('email', 'linkedin_connect', 'linkedin_message');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('pending', 'queued', 'sent', 'failed', 'opened', 'replied', 'bounced', 'unsubscribed', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE suppression_reason AS ENUM ('unsubscribe', 'bounce', 'complaint', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----- PROFILES -----
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  sender_identity TEXT,
  linkedin_mode linkedin_mode NOT NULL DEFAULT 'manual',
  encrypted_dek BYTEA NOT NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- USER_INTEGRATIONS (credentials chiffrés) -----
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  encrypted_payload BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  last_verified_at TIMESTAMPTZ,
  last4 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- ----- CONTACTS -----
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  company_name TEXT,
  role TEXT,
  industry TEXT,
  company_size TEXT,
  country TEXT DEFAULT 'FR',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_basis TEXT NOT NULL DEFAULT 'legitimate_interest',
  source TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON public.contacts(user_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_filters ON public.contacts(user_id, role, industry, country);

-- ----- SEGMENTS -----
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  contact_count_cached INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- TEMPLATES -----
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel template_channel NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT NOT NULL,
  variables_used TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- CAMPAIGNS -----
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel template_channel NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  daily_quota INT NOT NULL DEFAULT 50,
  throttle_seconds INT NOT NULL DEFAULT 30,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- MESSAGES_GENERATED -----
CREATE TABLE IF NOT EXISTS public.messages_generated (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel template_channel NOT NULL,
  subject TEXT,
  body_rendered TEXT NOT NULL,
  ai_refined BOOLEAN NOT NULL DEFAULT false,
  status message_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  error_message TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_status ON public.messages_generated(campaign_id, status);

-- ----- SUPPRESSION_LIST -----
CREATE TABLE IF NOT EXISTS public.suppression_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason suppression_reason NOT NULL,
  unsubscribe_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- ----- AUDIT_LOGS -----
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON public.audit_logs(user_id, created_at DESC);

-- ----- TRIGGER auto-update updated_at -----
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ DECLARE t text;
BEGIN FOR t IN SELECT unnest(ARRAY[
    'profiles','user_integrations','contacts','segments','templates','campaigns'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_%1$s ON public.%1$I;', t);
    EXECUTE format('CREATE TRIGGER touch_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();', t);
  END LOOP;
END $$;
