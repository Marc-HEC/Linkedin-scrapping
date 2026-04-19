-- ============================================================
-- Passage des colonnes chiffrées de BYTEA à TEXT (base64).
-- Raison : supabase-js (postgrest-js) sérialise les Buffer en JSON via
-- JSON.stringify qui produit `{"type":"Buffer","data":[...]}` — illisible
-- par PostgREST côté BYTEA. Stocker en base64 TEXT est interopérable et
-- le chiffrement applicatif (AES-256-GCM) reste strictement le même.
-- ============================================================

-- profiles.encrypted_dek
ALTER TABLE public.profiles
  ALTER COLUMN encrypted_dek TYPE TEXT USING encode(encrypted_dek, 'base64');

-- user_integrations : ciphertext + iv + authTag
ALTER TABLE public.user_integrations
  ALTER COLUMN encrypted_payload TYPE TEXT USING encode(encrypted_payload, 'base64'),
  ALTER COLUMN iv TYPE TEXT USING encode(iv, 'base64'),
  ALTER COLUMN auth_tag TYPE TEXT USING encode(auth_tag, 'base64');

-- Note :
-- Si des lignes existaient déjà avec des BYTEA mal sérialisés (via JSON
-- Buffer array), la conversion base64 produit des chaînes valides mais
-- dont le contenu reste inexploitable par AES-GCM. Il faut alors
-- supprimer ces lignes et recréer le compte :
--   DELETE FROM public.user_integrations WHERE user_id = '<uid>';
--   DELETE FROM public.profiles          WHERE id      = '<uid>';
--   DELETE FROM auth.users               WHERE id      = '<uid>';
