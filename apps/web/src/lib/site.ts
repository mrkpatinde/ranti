// Origine canonique du site : apex sans www (choix produit, cf. Google Search
// Console — Google dédoublonnait http/www/apex). Base des URLs absolues des
// métadonnées, du sitemap et du robots. Volontairement figée (pas d'env) : la
// canonique ne doit pas varier selon l'environnement, sinon Google recommence à
// deviner. Les previews Vercel sont déjà noindex côté plateforme.
export const SITE_URL = "https://monranti.com"
