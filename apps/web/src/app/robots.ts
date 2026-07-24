import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Autorise le public, sort de l'index les surfaces nominatives : quittances par
// jeton (/recu/) et vérifications d'un document réel (/verifier/<id> affiche le
// locataire et le montant). /verifier/demo reste autorisé, c'est une page
// marketing volontairement publique ; Google applique la règle la plus
// spécifique, donc l'autorisation l'emporte sur le blocage du préfixe.
// /verifier (recherche par référence, lié depuis le footer) porte un meta
// noindex qui n'est honoré QUE si la page reste crawlable : le disallow garde
// sa barre finale (/verifier/ ne matche pas /verifier) et /verifier est listé
// en allow explicite. Ne jamais « nettoyer » le disallow en /verifier sans
// barre : la page deviendrait « indexée mais bloquée » via le lien sitewide.
// L'espace connecté redirige déjà vers la connexion, inutile de le lister.
// `host` renforce le signal apex (canonique).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/verifier", "/verifier/demo"],
      disallow: ["/recu/", "/verifier/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
