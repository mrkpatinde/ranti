"use client"

import { useFormStatus } from "react-dom"
import { useOnline } from "@/lib/use-online"

// Submit button with a built-in pending state: while the form action runs it
// disables itself and swaps the label, so the owner sees the action is working
// (no more "is it loading or did it crash?"). Must live inside a <form>.
// Hors ligne (#167 Phase 2), il se désactive AVANT l'envoi : mieux vaut
// attendre le réseau que laisser partir un POST qui échouera en silence —
// la saisie reste intacte, le bandeau global explique la situation.
export function SubmitButton({
  children,
  className,
  pendingLabel = "Patientez…",
}: {
  children: React.ReactNode
  className?: string
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  const online = useOnline()

  return (
    <button
      type="submit"
      className={className}
      disabled={pending || !online}
      aria-busy={pending}
      aria-disabled={!online || undefined}
    >
      {pending ? pendingLabel : online ? children : "Hors ligne — en attente du réseau"}
    </button>
  )
}
