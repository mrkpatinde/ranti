"use client"

import { useState } from "react"

// Champs « logement + loyer + jour d'échéance » du formulaire de bail.
// Sélectionner un logement pré-remplit son loyer et son jour par défaut
// (ADR-016) : le propriétaire ne re-saisit plus ce qu'il a déjà donné au
// logement. Les valeurs restent éditables — le bail garde le dernier mot.

export type UnitOption = {
  id: string
  name: string
  default_rent_amount: number | null
  default_due_day: number | null
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

export function LeaseUnitFields({
  units,
  defaultUnitId,
}: {
  units: UnitOption[]
  defaultUnitId: string
}) {
  const initial = units.find((u) => u.id === defaultUnitId) ?? units[0]
  const [unitId, setUnitId] = useState(initial?.id ?? "")
  const [rent, setRent] = useState(
    initial?.default_rent_amount != null ? String(initial.default_rent_amount) : "",
  )
  const [dueDay, setDueDay] = useState(
    initial?.default_due_day != null ? String(initial.default_due_day) : "",
  )

  const onUnitChange = (id: string) => {
    setUnitId(id)
    const unit = units.find((u) => u.id === id)
    // On ne pré-remplit que si le logement porte un défaut : on n'efface pas
    // une valeur déjà saisie à la main en passant sur un logement sans prix.
    if (unit?.default_rent_amount != null) setRent(String(unit.default_rent_amount))
    if (unit?.default_due_day != null) setDueDay(String(unit.default_due_day))
  }

  return (
    <>
      <div className="space-y-2">
        <label htmlFor="unit_id" className={labelClass}>
          Logement <span className="text-red-700">*</span>
        </label>
        <select
          id="unit_id"
          name="unit_id"
          required
          value={unitId}
          onChange={(e) => onUnitChange(e.target.value)}
          className={inputClass}
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
        <p className="text-sm leading-6 text-muted-foreground">
          ⓘ Le loyer et le jour d&apos;échéance du logement sont repris automatiquement. Ajustez-les si besoin.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="monthly_rent_amount" className={labelClass}>
          Loyer mensuel (FCFA) <span className="text-red-700">*</span>
        </label>
        <input
          id="monthly_rent_amount"
          name="monthly_rent_amount"
          type="text"
          inputMode="numeric"
          required
          value={rent}
          onChange={(e) => setRent(e.target.value)}
          placeholder="Ex. 50000"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="due_day" className={labelClass}>
          Jour d&apos;échéance (1 à 31) <span className="text-red-700">*</span>
        </label>
        <input
          id="due_day"
          name="due_day"
          type="number"
          min={1}
          max={31}
          required
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          placeholder="Ex. 5"
          className={inputClass}
        />
        <p className="text-sm leading-6 text-muted-foreground">ⓘ C&apos;est ce jour qui pilote le suivi : rappel automatique avant l&apos;échéance, relance en cas de retard. Choisissez le jour réellement convenu avec le locataire.</p>
      </div>
    </>
  )
}
