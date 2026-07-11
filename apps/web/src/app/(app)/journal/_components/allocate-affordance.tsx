"use client"

import { useState } from "react"

// Affordance discrète d'allocation (ADR-014). Prépare la future feature
// « affecter en un clic » un encaissement Fast-Log à une échéance. Pour l'instant
// un point d'entrée sobre : le câblage réel (modale de choix d'échéance) viendra.
export function AllocateAffordance({ refId }: { refId: string }): React.JSX.Element {
  const [touched, setTouched] = useState(false)

  const onAllocate = (eventId: string) => {
    // Placeholder : future ouverture de la modale d'allocation.
    setTouched(true)
    void eventId
  }

  return (
    <button
      type="button"
      onClick={() => onAllocate(refId)}
      className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      aria-label="Affecter cet encaissement à une échéance"
    >
      {touched ? "Bientôt" : "Affecter"}
    </button>
  )
}
