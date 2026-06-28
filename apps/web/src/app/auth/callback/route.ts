import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "@/lib/auth/paths"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(
      new URL(`${AUTH_PATHS.signIn}?error=${encodeURIComponent("Connexion Google annulée.")}`, origin)
    )
  }

  const supabase = await createClient()

  // Exchange the code for a session
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("auth/callback: exchangeCodeForSession failed", error.message)
    return NextResponse.redirect(
      new URL(`${AUTH_PATHS.signIn}?error=${encodeURIComponent("Connexion impossible. Réessayez.")}`, origin)
    )
  }

  revalidatePath("/", "layout")

  // Check if the user has a landlord profile — if not, redirect to onboarding
  const { data: landlord } = await supabase
    .from("landlords")
    .select("id, phone")
    .is("deleted_at", null)
    .maybeSingle()

  // No profile yet → onboarding
  if (!landlord) {
    return NextResponse.redirect(new URL(AUTH_PATHS.profile, origin))
  }

  // Profile exists but no phone → prompt for phone (needed for WhatsApp reminders)
  if (!landlord.phone) {
    return NextResponse.redirect(
      new URL(`${AUTH_PATHS.profile}?missing=phone`, origin)
    )
  }

  return NextResponse.redirect(new URL(AUTH_PATHS.afterSignIn, origin))
}
