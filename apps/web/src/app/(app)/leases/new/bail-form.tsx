"use client"

import { useActionState, useState } from "react"
import { SubmitButton } from "@/components/submit-button"
import { createBail, type BailFormState } from "@/lib/onboarding/actions"
import type { BailRowInput } from "@/lib/onboarding/validation"

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
const subTitle = "text-sm font-semibold text-muted-foreground"
const toggleWrap = "flex gap-1 rounded-full border border-border bg-card p-1 text-sm"
const toggleBtn = (active: boolean) =>
  `flex-1 rounded-full px-3 py-2.5 text-sm font-medium transition ${active ? "bg-accent text-accent-foreground" : "text-foreground/70"}`

type RowState = { key: number; occupied: boolean }

// Champs occupant + bail : une ligne « encore libre » les soumet vides en
// caché pour garder les getAll() du serveur alignés par index.
const TENANT_LEASE_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "monthly_rent_amount",
  "due_day",
  "start_date",
] as const

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
  // En cas d'échec, l'action renvoie le message, la ligne fautive ET les
  // valeurs saisies : le formulaire les repose en defaultValue — rien à retaper.
  const initialState: BailFormState = { error: errorMessage ?? null, errorRow: null, values: null }
  const [state, formAction] = useActionState(createBail, initialState)
  const v = state.values

  // Lignes logement (#166, Journeys 4-5) : plusieurs d'un geste, occupées ou
  // encore libres. La 1re ligne EST le formulaire historique — zéro friction
  // ajoutée au cas mono-logement.
  const [rows, setRows] = useState<RowState[]>([{ key: 0, occupied: true }])
  const [nextKey, setNextKey] = useState(1)

  // Après une erreur serveur, réaligne la structure (nombre de lignes + statut
  // occupé) sur la saisie renvoyée ; les valeurs reviennent en defaultValue.
  // Pattern React « ajuster l'état pendant le rendu » (pas d'effet) : on ne
  // resynchronise qu'au changement d'identité du state d'action.
  const [syncedState, setSyncedState] = useState<BailFormState>(initialState)
  if (state !== syncedState) {
    setSyncedState(state)
    if (state.values?.rows) {
      setRows(state.values.rows.map((r, i) => ({ key: i, occupied: r.occupied === "1" })))
      setNextKey(state.values.rows.length)
    }
  }

  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, occupied: true }])
    setNextKey((k) => k + 1)
  }
  const removeRow = (key: number) => {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))
  }
  const setOccupied = (key: number, occupied: boolean) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, occupied } : r)))
  }

  const submitLabel =
    rows.length > 1
      ? "Créer les logements et les baux"
      : rows[0]?.occupied
        ? "Créer le bail"
        : "Créer le logement"

  return (
    <form action={formAction} className="space-y-8">
      {state.error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="property_mode" value={propertyMode} />

      <section className="space-y-4">
        <h2 className={sectionTitle}>Lieu</h2>

        {hasProperties ? (
          <div className={toggleWrap}>
            <button type="button" onClick={() => setPropertyMode("existing")} className={toggleBtn(propertyMode === "existing")}>
              Un lieu existant
            </button>
            <button type="button" onClick={() => setPropertyMode("new")} className={toggleBtn(propertyMode === "new")}>
              Nouveau lieu
            </button>
          </div>
        ) : null}

        {propertyMode === "existing" && hasProperties ? (
          <div className="space-y-2">
            <label htmlFor="property_id" className={labelClass}>Lieu</label>
            <select id="property_id" name="property_id" defaultValue={v?.propertyId || properties[0]?.id} className={inputClass}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="property_name" className={labelClass}>Nom du lieu<Req /></label>
              <input id="property_name" name="property_name" defaultValue={v?.propertyName} placeholder="Résidence Calavi" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor="property_city" className={labelClass}>Ville (optionnel)</label>
              <input id="property_city" name="property_city" defaultValue={v?.propertyCity} placeholder="Calavi" className={inputClass} />
            </div>
          </>
        )}
      </section>

      {rows.map((row, i) => (
        <RowFields
          key={row.key}
          row={row}
          index={i}
          total={rows.length}
          defaults={v?.rows[i]}
          hasError={state.errorRow === i}
          onSetOccupied={setOccupied}
          onRemove={removeRow}
        />
      ))}

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary lg:w-fit"
      >
        + Ajouter un autre logement
      </button>

      <SubmitButton className="w-full rounded-full bg-accent px-5 py-4 text-base font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60 lg:w-fit">
        {submitLabel}
      </SubmitButton>
    </form>
  )
}

function Req() {
  return <span className="text-destructive"> *</span>
}

// Une ligne logement : nom + type, puis occupant + bail si « déjà occupé ».
// La ligne fautive (validation ou RPC « row N ») est surlignée en destructive.
function RowFields({
  row,
  index,
  total,
  defaults,
  hasError,
  onSetOccupied,
  onRemove,
}: {
  row: RowState
  index: number
  total: number
  defaults: BailRowInput | undefined
  hasError: boolean
  onSetOccupied: (key: number, occupied: boolean) => void
  onRemove: (key: number) => void
}) {
  const k = row.key
  const multi = total > 1

  return (
    <section
      className={`space-y-4 ${multi ? `rounded-2xl border bg-card p-4 ${hasError ? "border-destructive/60 ring-1 ring-destructive/40" : "border-border"}` : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitle}>{multi ? `Logement ${index + 1}` : "Logement"}</h2>
        {multi ? (
          <button
            type="button"
            onClick={() => onRemove(k)}
            className="text-sm font-medium text-destructive underline-offset-4 transition hover:underline"
          >
            Retirer
          </button>
        ) : null}
      </div>

      <input type="hidden" name="occupied" value={row.occupied ? "1" : "0"} />

      <div className="space-y-2">
        <label htmlFor={`unit_name-${k}`} className={labelClass}>Nom du logement<Req /></label>
        <input id={`unit_name-${k}`} name="unit_name" defaultValue={defaults?.unitName} placeholder="Chambre 1" className={inputClass} />
      </div>
      <div className="space-y-2">
        <label htmlFor={`unit_type-${k}`} className={labelClass}>Type</label>
        <select id={`unit_type-${k}`} name="unit_type" defaultValue={defaults?.unitType || "room"} className={inputClass}>
          {UNIT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={toggleWrap}>
        <button type="button" onClick={() => onSetOccupied(k, true)} className={toggleBtn(row.occupied)}>
          Déjà occupé
        </button>
        <button type="button" onClick={() => onSetOccupied(k, false)} className={toggleBtn(!row.occupied)}>
          Encore libre
        </button>
      </div>

      {row.occupied ? (
        <>
          <h3 className={subTitle}>Occupant</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor={`first_name-${k}`} className={labelClass}>Prénom<Req /></label>
              <input id={`first_name-${k}`} name="first_name" defaultValue={defaults?.firstName} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor={`last_name-${k}`} className={labelClass}>Nom<Req /></label>
              <input id={`last_name-${k}`} name="last_name" defaultValue={defaults?.lastName} className={inputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor={`phone-${k}`} className={labelClass}>Téléphone<Req /></label>
            <input id={`phone-${k}`} name="phone" type="tel" inputMode="tel" defaultValue={defaults?.phone} placeholder="+229 01 23 45 67 89" className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor={`email-${k}`} className={labelClass}>Email (optionnel)</label>
            <input id={`email-${k}`} name="email" type="email" defaultValue={defaults?.email} className={inputClass} />
          </div>

          <h3 className={subTitle}>Bail</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor={`monthly_rent_amount-${k}`} className={labelClass}>Loyer mensuel (FCFA)<Req /></label>
              <input id={`monthly_rent_amount-${k}`} name="monthly_rent_amount" inputMode="numeric" defaultValue={defaults?.monthlyRentAmount} placeholder="50000" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor={`due_day-${k}`} className={labelClass}>Jour d&apos;échéance<Req /></label>
              <input id={`due_day-${k}`} name="due_day" inputMode="numeric" defaultValue={defaults?.dueDay} placeholder="5" className={inputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor={`start_date-${k}`} className={labelClass}>Date de début<Req /></label>
            <input id={`start_date-${k}`} name="start_date" type="date" defaultValue={defaults?.startDate} className={inputClass} />
            <p className="text-sm leading-6 text-muted-foreground">
              Les échéances mensuelles sont générées à partir de cette date, au jour choisi.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            Le logement sera créé disponible, sans locataire ni bail. Vous créerez le bail
            quand il trouvera son occupant.
          </p>
          {TENANT_LEASE_FIELDS.map((name) => (
            <input key={name} type="hidden" name={name} value="" />
          ))}
        </>
      )}
    </section>
  )
}
