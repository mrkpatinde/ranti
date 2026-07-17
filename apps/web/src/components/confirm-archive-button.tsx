"use client"

import { buttonClasses } from "@/components/ui/button"
import { SubmitButton } from "@/components/submit-button"

// Archivage = action VISIBLE et confirmée (ADR-020, correctif interaction :
// jamais de reveal caché). Le server action (archiveUnit / archiveProperty /
// archiveTenant) est passé en prop par la page serveur — jamais importé ici,
// sinon lib/supabase/server serait tiré dans le bundle client. Miroir de
// ArchiveLeaseButton, généralisé aux trois entités.
export function ConfirmArchiveButton({
  id,
  action,
  label,
  confirmMessage,
}: {
  id: string
  action: (formData: FormData) => void | Promise<void>
  label: string
  confirmMessage: string
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton className={buttonClasses("destructive-outline")}>
        {label}
      </SubmitButton>
    </form>
  )
}
