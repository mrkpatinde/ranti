import { redirect } from "next/navigation"
import { AUTH_PATHS } from "@/lib/auth"

// Parcours téléphone gelé (auth Google-only temporaire) : pas de mot de passe,
// donc pas de récupération. Les actions serveur restent dans lib/auth/actions.ts
// pour un dégel futur. Voir BUILD_STATUS.
export default function RecoverPage() {
  redirect(AUTH_PATHS.signIn)
}
