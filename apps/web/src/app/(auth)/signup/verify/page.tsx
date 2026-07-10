import { redirect } from "next/navigation"
import { AUTH_PATHS } from "@/lib/auth"

// Parcours téléphone gelé (auth Google-only temporaire). L'OTP d'inscription
// n'est plus accessible ; les actions serveur restent dans lib/auth/actions.ts
// pour un dégel futur. Voir BUILD_STATUS.
export default function VerifySignupPage() {
  redirect(AUTH_PATHS.signUp)
}
