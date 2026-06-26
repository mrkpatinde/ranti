import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "@/lib/auth/paths"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? AUTH_PATHS.afterSignIn

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete("token_hash")
  redirectTo.searchParams.delete("type")

  if (tokenHash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      redirectTo.searchParams.delete("next")
      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = AUTH_PATHS.authError

  return NextResponse.redirect(redirectTo)
}