"use client"

import { buttonClasses } from "@/components/ui/button"
import { SubmitButton } from "@/components/submit-button"

// Archive du bail = action VISIBLE sur le détail (ADR-020, correctif interaction :
// jamais de reveal caché). Le server action endLease est passé en prop par la
// page (jamais importé ici — sinon lib/supabase/server serait tiré dans le
// bundle client). Action définitive → confirmation native avant envoi.
export function ArchiveLeaseButton({
  leaseId,
  action,
}: {
  leaseId: string
  action: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Archiver ce bail ? Les échéances et les relances s'arrêtent. Action définitive.")) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={leaseId} />
      <SubmitButton className={buttonClasses("destructive-outline")}>
        Archiver le bail
      </SubmitButton>
    </form>
  )
}
