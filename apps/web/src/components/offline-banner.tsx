"use client"

// #167 Phase 2 — dire la vérité sur l'état du réseau, calmement (boussole
// « fiable/sérieux » : rien d'anxiogène, rien qui clignote). Le bandeau
// apparaît quand la connexion tombe et disparaît dès son retour ; la saisie
// en cours n'est jamais perdue (les formulaires la préservent) et les boutons
// d'envoi attendent le réseau (SubmitButton).
import { useOnline } from "@/lib/use-online"

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null

  // Barre fixe en bas (pattern snackbar Android) : toujours visible, près des
  // CTA, sans se battre avec le header sticky du shell mobile.
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-warning/40 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-warning backdrop-blur-sm"
    >
      Hors ligne — vos données restent visibles. L&apos;enregistrement attendra le
      retour du réseau.
    </div>
  )
}
