-- ============================================================
-- Providers OutX + Apollo, dédup contacts (upsert), GDPR suppression
-- ============================================================

-- 1) Ajoute OutX et Apollo au enum de providers d'intégration
DO $$ BEGIN
  ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'outx';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'apollo';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Indices uniques partiels pour upsert idempotent lors des imports
-- NULLs ignorés : on peut avoir plusieurs contacts sans email ou sans linkedin_url.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_user_email
  ON public.contacts (user_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_user_linkedin
  ON public.contacts (user_id, linkedin_url)
  WHERE linkedin_url IS NOT NULL;

-- 3) Suppression list : generate un token de désinscription par ligne
ALTER TABLE public.suppression_list
  ALTER COLUMN unsubscribe_token SET DEFAULT encode(gen_random_bytes(24), 'base64url');

-- 4) RPC: stats campagnes par statut (pour dashboard analytics)
CREATE OR REPLACE FUNCTION public.campaign_stats(p_user UUID)
RETURNS TABLE (
  total_messages BIGINT,
  sent BIGINT,
  failed BIGINT,
  skipped BIGINT,
  pending BIGINT,
  replied BIGINT,
  bounced BIGINT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'skipped')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'replied')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'bounced')::BIGINT
  FROM public.messages_generated
  WHERE user_id = p_user;
$$;

GRANT EXECUTE ON FUNCTION public.campaign_stats(UUID) TO authenticated;
