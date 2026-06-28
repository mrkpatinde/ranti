"use client"

import { useFormStatus } from "react-dom"

// Submit button with a built-in pending state: while the form action runs it
// disables itself and swaps the label, so the owner sees the action is working
// (no more "is it loading or did it crash?"). Must live inside a <form>.
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
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  )
}
