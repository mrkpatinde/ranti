"use client"

import Link from "next/link"
import { useState } from "react"
import { BeninPhoneInput } from "@/components/benin-phone-input"
import { SubmitButton } from "@/components/submit-button"
import { createUnit } from "@/lib/units/actions"
import { createOccupiedUnit } from "@/lib/onboarding/actions"

// Création d'un logement en un seul écran (ADR-016). « Ce logement est-il déjà
// occupé ? » évite de ressortir créer le locataire puis le bail : si oui, on
// saisit locataire + bail ici et on passe par la RPC atomique d'onboarding.
// Si non, on peut renseigner un loyer par défaut qui pré-remplira les futurs
// baux du logement.

type Property = { id: string; name: string }

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
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

export function UnitCreateForm({
  properties,
  selectedPropertyId,
  occupiedDefault,
}: {
  properties: Property[]
  selectedPropertyId: string
  occupiedDefault: boolean
}) {
  const [occupied, setOccupied] = useState(occupiedDefault)

  return (
    <form action={occupied ? createOccupiedUnit : createUnit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="property_id" className={labelClass}>
          Lieu <span className="text-red-700">*</span>
        </label>
        <select
          id="property_id"
          name="property_id"
          required
          defaultValue={selectedPropertyId}
          className={inputClass}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className={labelClass}>
          Nom du logement <span className="text-red-700">*</span>
        </label>
        <input id="name" name="name" type="text" required placeholder="Ex. Chambre 1" className={inputClass} />
      </div>

      <div className="space-y-2">
        <label htmlFor="unit_type" className={labelClass}>
          Type <span className="text-red-700">*</span>
        </label>
        <select id="unit_type" name="unit_type" required defaultValue="room" className={inputClass}>
          {UNIT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Interrupteur : logement déjà occupé ? */}
      <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
        <input
          type="checkbox"
          checked={occupied}
          onChange={(e) => setOccupied(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-sm text-foreground/80">
          <span className="font-medium text-foreground">Ce logement est déjà occupé</span>
          <br />
          Renseignez le locataire et le bail ici même — pas besoin de ressortir.
        </span>
      </label>

      {occupied ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Locataire en place</p>

          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>
              Prénom <span className="text-red-700">*</span>
            </label>
            <input id="first_name" name="first_name" type="text" required placeholder="Ex. Awa" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>
              Nom <span className="text-red-700">*</span>
            </label>
            <input id="last_name" name="last_name" type="text" required placeholder="Ex. Koffi" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>
              Numéro WhatsApp <span className="text-red-700">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-border bg-background px-4 py-3 text-base text-foreground/70">
                🇧🇯 +229
              </span>
              <BeninPhoneInput id="phone" name="phone" required className={phoneInputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className={labelClass}>
              Email <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <input id="email" name="email" type="email" placeholder="Ex. awa@email.com" className={inputClass} />
          </div>

          <p className="pt-1 text-sm font-semibold text-foreground">Bail</p>

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
              placeholder="Ex. 50000"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="due_day" className={labelClass}>
              Jour d&apos;échéance (1 à 31) <span className="text-red-700">*</span>
            </label>
            <input id="due_day" name="due_day" type="number" min={1} max={31} required placeholder="Ex. 5" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label htmlFor="start_date" className={labelClass}>
              Date de début <span className="text-red-700">*</span>
            </label>
            <input id="start_date" name="start_date" type="date" required className={inputClass} />
            <p className="text-sm leading-6 text-muted-foreground">
              ⓘ Les échéances mensuelles seront générées à partir de cette date. Le bail est activé automatiquement.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="default_rent_amount" className={labelClass}>
              Loyer habituel (FCFA) <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <input
              id="default_rent_amount"
              name="default_rent_amount"
              type="text"
              inputMode="numeric"
              placeholder="Ex. 50000"
              className={inputClass}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              ⓘ Pré-rempli automatiquement quand vous créerez le bail de ce logement. Modifiable à tout moment.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="default_due_day" className={labelClass}>
              Jour d&apos;échéance habituel (1 à 31) <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <input
              id="default_due_day"
              name="default_due_day"
              type="number"
              min={1}
              max={31}
              placeholder="Ex. 5"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Note <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <textarea id="notes" name="notes" rows={3} placeholder="Ex. au fond de la cour" className={inputClass} />
          </div>
        </div>
      )}

      <SubmitButton className="w-full rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
        {occupied ? "Ajouter le logement et son locataire" : "Ajouter ce logement"}
      </SubmitButton>

      {!occupied ? (
        <p className="text-center text-sm text-foreground/70">
          Plusieurs logements à ajouter ?{" "}
          <Link href="/units/bulk" className="font-medium text-primary underline-offset-4 hover:underline">
            Les ajouter en une fois
          </Link>
        </p>
      ) : null}
    </form>
  )
}
