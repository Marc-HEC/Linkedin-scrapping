-- ============================================================
-- Trigger auth.users → création automatique du profil
-- avec DEK aléatoire (32 bytes) chiffrée par APP_MASTER_KEY
-- ============================================================

-- La DEK est chiffrée côté serveur Next.js (server action) AVANT insertion,
-- pas dans Postgres (pour éviter d'avoir APP_MASTER_KEY en base).
-- Ici on crée juste une ligne vide dans profiles que la server action
-- complètera. Alternative : chiffrer dans Postgres via pgcrypto + vault.
--
-- Approche retenue : le signup server action de Next.js fait :
--   1. supabase.auth.signUp(...)
--   2. Génère DEK, chiffre avec APP_MASTER_KEY (côté app)
--   3. Insert profile via service_role avec encrypted_dek déjà chiffrée
--
-- Donc pas de trigger DB — tout se fait côté applicatif pour contrôle total.
-- Ce fichier est conservé vide pour documenter la décision.

SELECT 1;
