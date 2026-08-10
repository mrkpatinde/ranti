import { SubmitButton } from "@/components/submit-button"
import { buttonClasses } from "@/components/ui/button"
import { feeRateInputValue } from "@/lib/owners"
import type { Owner } from "@/lib/owners"

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

/**
 * Formulaire du propriétaire mandant, partagé entre création et modification.
 * Le taux se saisit en pourcentage : la conversion en points de base se fait à
 * l'enregistrement (lib/owners/validation.ts).
 */
export function OwnerForm({
  action,
  owner,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>
  owner?: Owner
  submitLabel: string
}) {
  return (
    <form action={action} className="space-y-5">
      {owner ? <input type="hidden" name="id" value={owner.id} /> : null}

      <div className="space-y-2">
        <label htmlFor="display_name" className={labelClass}>
          Nom du propriétaire
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          defaultValue={owner?.display_name ?? ""}
          placeholder="Awa Diallo, ou SCI Fifadji"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="phone" className={labelClass}>
          Téléphone <span className="text-muted-foreground">(optionnel)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={owner?.phone ?? ""}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className={labelClass}>
          E-mail <span className="text-muted-foreground">(optionnel)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={owner?.email ?? ""}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="fee_rate_percent" className={labelClass}>
          Taux d&apos;honoraires
        </label>
        <div className="flex items-center gap-3">
          <input
            id="fee_rate_percent"
            name="fee_rate_percent"
            type="text"
            inputMode="decimal"
            placeholder="8,5"
            defaultValue={owner ? feeRateInputValue(owner.fee_rate_bp) : ""}
            className={inputClass}
          />
          <span className="text-base text-muted-foreground">%</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Part du loyer encaissé que vous gardez. Laissez vide pour aucun honoraire.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className={labelClass}>
          Note <span className="text-muted-foreground">(optionnel)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={owner?.notes ?? ""}
          className={inputClass}
        />
      </div>

      <SubmitButton className={buttonClasses("primary", "w-full")}>{submitLabel}</SubmitButton>
    </form>
  )
}
