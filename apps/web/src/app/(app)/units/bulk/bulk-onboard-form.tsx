"use client"

import { useActionState, useState } from "react"
import { SubmitButton } from "@/components/submit-button"
import { bulkOnboard, type BulkOnboardState } from "@/lib/onboarding/actions"

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

type Row = {
  unitName: string
  firstName: string
  lastName: string
  phone: string
  monthlyRentAmount: string
  startDate: string
}

const EMPTY_ROW: Row = {
  unitName: "",
  firstName: "",
  lastName: "",
  phone: "",
  monthlyRentAmount: "",
  startDate: "",
}

const inputBase =
  "w-full rounded-xl border bg-card px-3 py-2.5 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-xs font-medium text-foreground/70"

export function BulkOnboardForm({
  properties,
}: {
  properties: { id: string; name: string }[]
}) {
  const [state, formAction] = useActionState<BulkOnboardState, FormData>(
    bulkOnboard,
    {},
  )
  const [rows, setRows] = useState<Row[]>([
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
  ])

  const setField = (index: number, field: keyof Row, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    )
  }
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }])
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index))

  const errFor = (rowNo: number, field: string) =>
    state.rowErrors?.find((e) => e.row === rowNo && e.field === field)?.message

  const inputClass = (rowNo: number, field: string) =>
    `${inputBase} ${errFor(rowNo, field) ? "border-red-400" : "border-border"}`

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <p className="text-sm leading-6 text-foreground/70">
        Renseignez une ligne par logement. Laissez le locataire et le loyer vides
        pour un logement encore libre — vous compléterez plus tard.
      </p>

      {state.formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.formError}
        </div>
      ) : null}

      {/* Entête partagée */}
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-secondary/40 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="property_id" className={labelClass}>
            Propriété
          </label>
          <select
            id="property_id"
            name="property_id"
            defaultValue={properties[0]?.id}
            className={`${inputBase} border-border`}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="unit_type" className={labelClass}>
            Type de logement
          </label>
          <select
            id="unit_type"
            name="unit_type"
            defaultValue="room"
            className={`${inputBase} border-border`}
          >
            {UNIT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="due_day" className={labelClass}>
            Jour d&apos;échéance
          </label>
          <input
            id="due_day"
            name="due_day"
            type="number"
            min={1}
            max={31}
            defaultValue={5}
            className={`${inputBase} border-border`}
          />
        </div>
      </section>

      {/* Lignes */}
      <div className="space-y-4">
        {rows.map((r, i) => {
          const rowNo = i + 1
          return (
            <fieldset
              key={i}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-foreground">
                  Logement {rowNo}
                </legend>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs font-medium text-foreground/60 underline-offset-4 hover:text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClass}>Nom du logement</label>
                  <input
                    value={r.unitName}
                    onChange={(e) => setField(i, "unitName", e.target.value)}
                    placeholder="Ex. Chambre 1"
                    className={inputClass(rowNo, "unitName")}
                  />
                  {errFor(rowNo, "unitName") ? (
                    <p className="text-xs text-red-600">{errFor(rowNo, "unitName")}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Prénom locataire</label>
                  <input
                    value={r.firstName}
                    onChange={(e) => setField(i, "firstName", e.target.value)}
                    placeholder="Ex. Aline"
                    className={inputClass(rowNo, "firstName")}
                  />
                  {errFor(rowNo, "firstName") ? (
                    <p className="text-xs text-red-600">{errFor(rowNo, "firstName")}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Nom locataire</label>
                  <input
                    value={r.lastName}
                    onChange={(e) => setField(i, "lastName", e.target.value)}
                    placeholder="Ex. Koffi"
                    className={inputClass(rowNo, "lastName")}
                  />
                  {errFor(rowNo, "lastName") ? (
                    <p className="text-xs text-red-600">{errFor(rowNo, "lastName")}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Téléphone locataire</label>
                  <input
                    value={r.phone}
                    onChange={(e) => setField(i, "phone", e.target.value)}
                    placeholder="+229 01 23 45 67 89"
                    inputMode="tel"
                    className={inputClass(rowNo, "phone")}
                  />
                  {errFor(rowNo, "phone") ? (
                    <p className="text-xs text-red-600">{errFor(rowNo, "phone")}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Loyer mensuel (FCFA)</label>
                  <input
                    value={r.monthlyRentAmount}
                    onChange={(e) =>
                      setField(i, "monthlyRentAmount", e.target.value)
                    }
                    placeholder="Ex. 50000"
                    inputMode="numeric"
                    className={inputClass(rowNo, "monthlyRentAmount")}
                  />
                  {errFor(rowNo, "monthlyRentAmount") ? (
                    <p className="text-xs text-red-600">
                      {errFor(rowNo, "monthlyRentAmount")}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClass}>Date de début du bail</label>
                  <input
                    type="date"
                    value={r.startDate}
                    onChange={(e) => setField(i, "startDate", e.target.value)}
                    className={inputClass(rowNo, "startDate")}
                  />
                  {errFor(rowNo, "startDate") ? (
                    <p className="text-xs text-red-600">{errFor(rowNo, "startDate")}</p>
                  ) : null}
                </div>
              </div>
            </fieldset>
          )
        })}
      </div>

      {/* Sérialisation des lignes pour la server action. */}
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary"
        >
          + Ajouter une ligne
        </button>
        <SubmitButton
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          pendingLabel="Enregistrement…"
        >
          Enregistrer tout
        </SubmitButton>
      </div>
    </form>
  )
}
