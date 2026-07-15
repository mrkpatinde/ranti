"use client"

import { useState } from "react"
import { SubmitButton } from "@/components/submit-button"
import { createBail } from "@/lib/onboarding/actions"

// Types de logement (valeurs UNIT_TYPES) avec libellés FR.
const UNIT_TYPE_OPTIONS = [
  { value: "room", label: "Chambre" },
  { value: "apartment", label: "Appartement" },
  { value: "house", label: "Maison" },
  { value: "shop", label: "Boutique" },
  { value: "store", label: "Magasin" },
  { value: "office", label: "Bureau" },
  { value: "warehouse", label: "Entrepôt" },
  { value: "other", label: "Autre" },
]

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"
const sectionTitle = "font-display text-lg font-bold tracking-tight text-foreground"
const req = <span className="text-destructive"> *</span>

export function BailForm({
  properties,
  errorMessage,
}: {
  properties: { id: string; name: string }[]
  errorMessage?: string
}) {
  const hasProperties = properties.length > 0
  const [propertyMode, setPropertyMode] = useState<"existing" | "new">(
    hasProperties ? "existing" : "new",
  )

  return (
    <form action={createBail} className="space-y-8">
      {errorMessage ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <input type="hidden" name="property_mode" value={propertyMode} />

      <section className="space-y-4">
        <h2 className={sectionTitle}>Lieu</h2>

        {hasProperties ? (
          <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-sm">
            <button
              type="button"
              onClick={() => setPropertyMode("existing")}
              className={`flex-1 rounded-full px-3 py-2 font-medium transition ${propertyMode === "existing" ? "bg-accent text-accent-foreground" : "text-foreground/70"}`}
            >
              Un lieu existant
            </button>
            <button
              type="button"
              onClick={() => setPropertyMode("new")}
              className={`flex-1 rounded-full px-3 py-2 font-medium transition ${propertyMode === "new" ? "bg-accent text-accent-foreground" : "text-foreground/70"}`}
            >
              Nouveau lieu
            </button>
          </div>
        ) : null}

        {propertyMode === "existing" && hasProperties ? (
          <div className="space-y-2">
            <label htmlFor="property_id" className={labelClass}>Lieu</label>
            <select id="property_id" name="property_id" defaultValue={properties[0]?.id} className={inputClass}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="property_name" className={labelClass}>Nom du lieu{req}</label>
              <input id="property_name" name="property_name" placeholder="Résidence Calavi" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor="property_city" className={labelClass}>Ville (optionnel)</label>
              <input id="property_city" name="property_city" placeholder="Calavi" className={inputClass} />
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <h2 className={sectionTitle}>Logement</h2>
        <div className="space-y-2">
          <label htmlFor="unit_name" className={labelClass}>Nom du logement{req}</label>
          <input id="unit_name" name="unit_name" placeholder="Chambre 1" className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="unit_type" className={labelClass}>Type</label>
          <select id="unit_type" name="unit_type" defaultValue="room" className={inputClass}>
            {UNIT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={sectionTitle}>Occupant</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>Prénom{req}</label>
            <input id="first_name" name="first_name" className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>Nom{req}</label>
            <input id="last_name" name="last_name" className={inputClass} />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="phone" className={labelClass}>Téléphone{req}</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+229 01 23 45 67 89" className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className={labelClass}>Email (optionnel)</label>
          <input id="email" name="email" type="email" className={inputClass} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={sectionTitle}>Bail</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="monthly_rent_amount" className={labelClass}>Loyer mensuel (FCFA){req}</label>
            <input id="monthly_rent_amount" name="monthly_rent_amount" inputMode="numeric" placeholder="50000" className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="due_day" className={labelClass}>Jour d&apos;échéance{req}</label>
            <input id="due_day" name="due_day" inputMode="numeric" placeholder="5" className={inputClass} />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="start_date" className={labelClass}>Date de début{req}</label>
          <input id="start_date" name="start_date" type="date" className={inputClass} />
          <p className="text-sm leading-6 text-muted-foreground">
            Les échéances mensuelles sont générées à partir de cette date, au jour choisi.
          </p>
        </div>
      </section>

      <SubmitButton className="w-full rounded-full bg-accent px-5 py-4 text-base font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60">
        Créer le bail
      </SubmitButton>
    </form>
  )
}
