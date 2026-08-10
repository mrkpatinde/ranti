// Origine canonique du site : apex sans www (choix produit, cf. Google Search
// Console : Google dédoublonnait http/www/apex). Base des URLs absolues des
// métadonnées, du sitemap et du robots. Volontairement figée (pas d'env) : la
// canonique ne doit pas varier selon l'environnement, sinon Google recommence à
// deviner. Les previews Vercel sont déjà noindex côté plateforme.
export const SITE_URL = "https://monranti.com"

// Origine sur laquelle un parcours OAuth doit partir ET revenir. PKCE dépose
// un cookie « code verifier » au départ et le relit au retour ; un cookie posé
// sur www.monranti.com n'est pas envoyé à monranti.com, et l'échange du code
// échoue sans message. Les deux hôtes de production sont donc ramenés à la
// canonique. Les previews Vercel et le local gardent leur propre hôte, sans
// quoi elles deviendraient inconnectables.
export function canonicalOAuthOrigin(host: string | null, protocol: string): string {
  const canonicalHost = new URL(SITE_URL).host
  if (!host) return SITE_URL
  if (host === canonicalHost || host === `www.${canonicalHost}`) return SITE_URL
  return `${protocol}://${host}`
}
