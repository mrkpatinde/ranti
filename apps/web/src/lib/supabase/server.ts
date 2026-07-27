import { createHmac } from 'node:crypto'
import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isLocalAuthEnabled, resolveLocalAuthUserId } from '@/lib/auth/local-identity'

// Bootstrap de session DÉVELOPPEMENT UNIQUEMENT (jamais en production).
// En mode auth locale (RANTI_LOCAL_AUTH), l'app fabrique des claims factices
// mais aucune vraie session Supabase n'existe : les lectures partiraient en
// `anon` et la RLS les bloquerait (42501). Ici, et SEULEMENT hors production,
// on forge un JWT `authenticated` pour l'utilisateur local, signé avec le
// secret JWT du stack Supabase LOCAL. PostgREST le valide → auth.uid() = sub
// → la RLS s'applique NORMALEMENT (on ne la contourne pas, contrairement à
// service_role : plus sûr, et ça ne dépend pas des grants de service_role).
// Permet de rendre le dashboard/journal en local, la QA et les e2e authentifiés.
// Double garde : NODE_ENV ≠ production ET flag RANTI_LOCAL_AUTH, portées par
// lib/auth/local-identity (source unique, sans cycle : local-identity n'importe
// que next/headers).
//
// Le sujet vient de la MÊME résolution que les claims applicatives : si les
// deux divergeaient, l'app croirait être un bailleur pendant que la RLS en
// servirait un autre — des données d'autrui sur l'écran d'un test.
async function mintLocalAuthToken(): Promise<string | null> {
  if (!isLocalAuthEnabled()) return null
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return null

  const sub = await resolveLocalAuthUserId()
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

// cache() : dédupe dans une même requête de rendu. Toutes les lib qui appellent
// createClient() dans un render partagent alors UN client (une lecture cookies,
// un mint token) au lieu d'en reconstruire un par appel.
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  const devToken = await mintLocalAuthToken()

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
})