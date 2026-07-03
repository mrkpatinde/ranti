// Canaux d'assistance Ranti affichés aux propriétaires.
// Valeurs surchargées via env pour changer sans redéploiement de code.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "aide@monranti.com"

// Numéro WhatsApp au format international sans "+" (exigé par wa.me).
// Pas de fallback : sans env configurée, le lien WhatsApp n'est pas affiché
// plutôt que de pointer vers un numéro inexistant.
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? null

export const SUPPORT_WHATSAPP_URL = SUPPORT_WHATSAPP
  ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Bonjour Ranti, j'ai besoin d'aide.")}`
  : null
export const SUPPORT_EMAIL_URL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Demande d'assistance Ranti")}`
