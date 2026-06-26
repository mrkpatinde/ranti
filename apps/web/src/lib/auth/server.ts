import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "./paths"
import type { AuthClaims, AuthUser, RequireAuthOptions } from "./types"

const LOCAL_AUTH_USER_ID = "00000000-0000-4000-8000-000000000001"
const LOCAL_AUTH_PHONE = "+22900000000"

function hasValidSubject(claims: unknown): claims is AuthClaims {
  return (
    typeof claims === "object" &&
    claims !== null &&
    "sub" in claims &&
    typeof (claims as { sub?: unknown }).sub === "string" &&
    Boolean((claims as { sub: string }).sub)
  )
}

export function isLocalAuthEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.RANTI_LOCAL_AUTH === "true"
}

function getLocalAuthClaims(): AuthClaims {
  return {
    sub: process.env.RANTI_LOCAL_AUTH_USER_ID ?? LOCAL_AUTH_USER_ID,
    phone: process.env.RANTI_LOCAL_AUTH_PHONE ?? LOCAL_AUTH_PHONE,
    role: "authenticated",
    aal: "aal1",
  }
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

  if (claims) {
    return claims
  }

  if (isLocalAuthEnabled()) {
    return getLocalAuthClaims()
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
    return getLocalAuthClaims().sub
  }

  return null
}
