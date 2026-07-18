"use client"

// Rouvre le panneau de consentement Axeptio (choix des cookies). L'API
// `openAxeptioCookies` est posée sur `window` par le SDK une fois chargé
// (voir components/axeptio.tsx) ; on la lit à la volée au clic.
export function ReopenConsent() {
  return (
    <button
      type="button"
      onClick={() => {
        ;(
          window as unknown as { openAxeptioCookies?: () => void }
        ).openAxeptioCookies?.()
      }}
      className="text-foreground font-medium underline underline-offset-2 hover:text-foreground/70 transition"
    >
      gérer mes préférences de cookies
    </button>
  )
}
