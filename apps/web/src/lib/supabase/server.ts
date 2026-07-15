import { createHmac } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Bootstrap de session DÉVELOPPEMENT UNIQUEMENT (jamais en production).
// En mode auth locale (RANTI_LOCAL_AUTH), l'app fabrique des claims factices
// mais aucune vraie session Supabase n'existe : les lectures partiraient en
// `anon` et la RLS les bloquerait (42501). Ici, et SEULEMENT hors production,
// on forge un JWT `authenticated` pour l'utilisateur local, signé avec le
// secret JWT du stack Supabase LOCAL. PostgREST le valide → auth.uid() = sub
// → la RLS s'applique NORMALEMENT (on ne la contourne pas, contrairement à
// service_role : plus sûr, et ça ne dépend pas des grants de service_role).
// Permet de rendre le dashboard/journal en local, la QA et les e2e authentifiés.
// Double garde : NODE_ENV ≠ production ET flag RANTI_LOCAL_AUTH. Inline pour
// éviter l'import circulaire avec lib/auth/server.
function mintLocalAuthToken(): string | null {
  const flag = process.env.RANTI_LOCAL_AUTH
  const enabled =
    process.env.NODE_ENV !== 'production' && (flag === 'true' || flag === '1')
  if (!enabled) return null
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return null

  const sub =
    process.env.RANTI_LOCAL_AUTH_USER_ID ?? '00000000-0000-4000-8000-000000000001'
  const now = Math.floor(Date.now() / 1000)
  const b64 = (v: string) => Buffer.from(v).toString('base64url')
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64(
    JSON.stringify({
      sub,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: now,
      exp: now + 3600,
    })
  )
  const sig = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}

export async function createClient() {
  const cookieStore = await cookies()

  const devToken = mintLocalAuthToken()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(devToken
        ? { global: { headers: { Authorization: `Bearer ${devToken}` } } }
        : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignoré quand appelé depuis un Server Component.
            // Le middleware s'occupera de rafraîchir la session.
          }
        },
      },
    }
  )
}