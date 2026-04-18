import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client service_role — BYPASS RLS.
 *  À utiliser UNIQUEMENT dans :
 *   - server actions après vérification d'authentification,
 *   - route handlers cron/webhooks validés par Bearer,
 *   - scripts admin.
 *  Jamais exposer ce client au code browser. */
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
