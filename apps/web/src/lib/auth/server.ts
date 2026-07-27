import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "./paths"
import { isLocalAuthEnabled, localAuthPhone, resolveLocalAuthUserId } from "./local-identity"
import type { AuthClaims, AuthUser, RequireAuthOptions } from "./types"

function hasValidSubject(claims: unknown): claims is AuthClaims {
  return (
    typeof claims === "object" &&
    claims !== null &&
    "sub" in claims &&
    typeof (claims as { sub?: unknown }).sub === "string" &&
    (claims as { sub: string }).sub.trim().length > 0
  )
}

// Ré-exporté pour ne pas casser les consommateurs existants ; la définition
// (et la double garde) vit dans lib/auth/local-identity.
export { isLocalAuthEnabled }

// Le sujet est résolu PAR REQUÊTE (en-tête d'isolation des tests), pas figé au
// démarrage : deux specs Playwright peuvent viser deux bailleurs distincts sur
// le même serveur de dev.
async function getLocalAuthClaims(): Promise<AuthClaims> {
  return {
    sub: await resolveLocalAuthUserId(),
    phone: localAuthPhone(),
    role: "authenticated",
    aal: "aal1",
  }
}

// cache() : requireAuth + getAuthUserId + les guards frappent getClaims dans le
// même render. Un seul appel réel par requête au lieu d'un par consommateur.
export const getAuthClaims = cache(async (): Promise<AuthClaims | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()

  if (error || !hasValidSubject(data?.claims)) {
    return null
  }

  return data.claims
})

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function requireAuth(options: RequireAuthOptions = {}): Promise<AuthClaims> {
  const claims = await getAuthClaims()

  if (claims) {
    return claims
  }

  if (isLocalAuthEnabled()) {
    return await getLocalAuthClaims()
  }

  redirect(options.redirectTo ?? AUTH_PATHS.signIn)
}

export async function requireGuest(redirectTo = AUTH_PATHS.afterSignIn) {
  const claims = await getAuthClaims()

  if (claims) {
    redirect(redirectTo)
  }
}

export async function getAuthUserId() {
  const claims = await getAuthClaims()

  if (claims?.sub) {
    return claims.sub
  }

  if (isLocalAuthEnabled()) {
    return (await getLocalAuthClaims()).sub
  }

  return null
}
