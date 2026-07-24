import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Autorise le public, sort de l'index les surfaces nominatives : quittances par
// jeton (/recu/) et vérifications d'un document réel (/verifier/<id> affiche le
// locataire et le montant). /verifier/demo reste autorisé, c'est une page
// marketing volontairement publique ; Google applique la règle la plus
// spécifique, donc l'autorisation l'emporte sur le blocage du préfixe.
// L'espace connecté redirige déjà vers la connexion, inutile de le lister.
// `host` renforce le signal apex (canonique).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/verifier/demo"],
      disallow: ["/recu/", "/verifier/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
