import type { User } from "@supabase/supabase-js"

export type AuthClaims = {
  sub: string
  email?: string
  phone?: string
  role?: string
  aal?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

export type AuthUser = User

export type AuthResult =
  | {
      ok: true
    }
  | {
      ok: false
      message: string
      code?: string
    }

export type RequireAuthOptions = {
  redirectTo?: string
}