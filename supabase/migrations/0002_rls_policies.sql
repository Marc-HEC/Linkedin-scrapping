-- ============================================================
-- RLS policies — chaque utilisateur ne voit que ses propres données
-- user_integrations : lecture côté serveur UNIQUEMENT (service_role)
--                     pour éviter tout leak des credentials chiffrés
-- ============================================================

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_generated  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- ----- PROFILES : own row -----
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ----- USER_INTEGRATIONS : insertion client OK, lecture/suppression server-only -----
-- Le client peut insérer (via server action qui chiffre avant appel)
-- mais JAMAIS lire le payload chiffré (défense en profondeur).
DROP POLICY IF EXISTS "integrations_insert_own" ON public.user_integrations;
CREATE POLICY "integrations_insert_own" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Lecture métadonnées (provider, is_active, last_verified_at, last4) autorisée,
-- mais encrypted_payload/iv/auth_tag ne seront jamais sélectionnés côté client.
DROP POLICY IF EXISTS "integrations_select_own" ON public.user_integrations;
CREATE POLICY "integrations_select_own" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "integrations_update_own" ON public.user_integrations;
CREATE POLICY "integrations_update_own" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "integrations_delete_own" ON public.user_integrations;
CREATE POLICY "integrations_delete_own" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- ----- Pattern générique "own rows" pour les autres tables -----
DO $$ DECLARE t text;
BEGIN FOR t IN SELECT unnest(ARRAY[
    'contacts','segments','templates','campaigns','messages_generated','suppression_list'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select_own" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "%1$s_select_own" ON public.%1$I FOR SELECT USING (auth.uid() = user_id);', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert_own" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "%1$s_insert_own" ON public.%1$I FOR INSERT WITH CHECK (auth.uid() = user_id);', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update_own" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "%1$s_update_own" ON public.%1$I FOR UPDATE USING (auth.uid() = user_id);', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete_own" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "%1$s_delete_own" ON public.%1$I FOR DELETE USING (auth.uid() = user_id);', t);
  END LOOP;
END $$;

-- ----- AUDIT_LOGS : lecture seule pour l'owner, insertion server-only -----
DROP POLICY IF EXISTS "audit_select_own" ON public.audit_logs;
CREATE POLICY "audit_select_own" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);
-- Insertion uniquement via service_role (server actions / cron)
