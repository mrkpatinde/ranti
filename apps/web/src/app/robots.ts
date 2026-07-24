import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Autorise le public, bloque les reçus par jeton (données locataire nominatives)
// de l'indexation. L'espace connecté redirige déjà vers la connexion, inutile de
// le lister. `host` renforce le signal apex (canonique).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/recu/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
