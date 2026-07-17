"use client"

// #167 Phase 2+3 — dire la vérité sur l'état du réseau, calmement (boussole
// « fiable/sérieux » : rien d'anxiogène, rien qui clignote). Le bandeau
// apparaît quand la connexion tombe et disparaît dès son retour ; la saisie
// en cours n'est jamais perdue (les formulaires la préservent) et les boutons
// d'envoi attendent le réseau (SubmitButton). Quand la page affichée vient du
// cache du service worker (Phase 3), le bandeau date les données.
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useOnline } from "@/lib/use-online"

// Heure de mise en cache de la page courante (en-tête `sw-cached-at` posé par
// public/sw.js), ou null si la page n'est pas en cache / pas de SW.
function useCachedAt(pathname: string, online: boolean): string | null {
  const [cachedAt, setCachedAt] = useState<string | null>(null)

  useEffect(() => {
    // Rien à lire en ligne (le bandeau ne s'affiche pas) ; la valeur se
    // rafraîchit par le chemin asynchrone à chaque passage hors ligne.
    if (online || !("caches" in window)) return
    let cancelled = false
    caches
      .match(pathname)
      .then((response) => {
        if (cancelled) return
        setCachedAt(response?.headers.get("sw-cached-at") ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname, online])

  return cachedAt
}

function formatCachedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OfflineBanner() {
  const online = useOnline()
  const pathname = usePathname()
  const cachedAt = useCachedAt(pathname, online)

  if (online) return null

  // Barre fixe en bas (pattern snackbar Android) : toujours visible, près des
  // CTA, sans se battre avec le header sticky du shell mobile.
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-warning/40 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-warning backdrop-blur-sm"
    >
      Hors ligne — vos données restent visibles
      {cachedAt ? ` (état du ${formatCachedAt(cachedAt)})` : ""}. L&apos;enregistrement
      attendra le retour du réseau.
    </div>
  )
}
