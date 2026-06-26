import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "./paths"
import type { AuthClaims, AuthUser, RequireAuthOptions } from "./types"

function hasValidSubject(claims: unknown): claims is AuthClaims {
  return (
    typeof claims === "object" &&
    claims !== null &&
    "sub" in claims &&
    typeof (claims as { sub?: unknown }).sub === "string" &&
    Boolean((claims as { sub: string }).sub)
  )
}

export async function getAuthClaims(): Promise<AuthClaims | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()

  if (error || !hasValidSubject(data?.claims)) {
    return null
  }

  return data.claims
}

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

  if (!claims) {
    redirect(options.redirectTo ?? AUTH_PATHS.signIn)
  }

  return claims
}

export async function requireGuest(redirectTo = AUTH_PATHS.afterSignIn) {
  const claims = await getAuthClaims()

  if (claims) {
    redirect(redirectTo)
  }
}

export async function getAuthUserId() {
  const claims = await getAuthClaims()

  return claims?.sub ?? null
}