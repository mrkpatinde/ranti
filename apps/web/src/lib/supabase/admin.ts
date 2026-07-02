import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

// Client admin (service role) — SERVEUR UNIQUEMENT.
// Bypass RLS : réservé aux tâches système (cron de relance).
// Ne jamais importer depuis un composant client.
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !secretKey) return null

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
