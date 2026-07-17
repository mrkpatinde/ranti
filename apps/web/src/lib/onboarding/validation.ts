// Validation de l'écran unique « Créer un bail » (ADR-020) : lieu + logement +
// occupant + bail en un geste. Aucune règle métier nouvelle : on réutilise les
// normalizers existants de units / tenants / leases / properties pour rester
// 100% conforme aux formulaires unitaires.

import { normalizeUnitName, normalizeUnitType } from "@/lib/units/validation"
import {
  isEmail,
  normalizeTenantName,
  normalizeTenantPhone,
} from "@/lib/tenants/validation"
import {
  normalizeDate,
  normalizeDueDay,
  normalizeRentAmount,
} from "@/lib/leases/validation"
import {
  normalizeOptionalPropertyText,
  normalizePropertyName,
} from "@/lib/properties/validation"

// Une ligne prête pour la RPC bulk_onboard_portfolio (valeurs texte, castées
// côté SQL).
export type BulkRpcRow = {
  unit_name: string
  unit_type: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  monthly_rent_amount?: string
  due_day?: string
  start_date?: string
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === ""
}

// ── Écran unique « Créer un bail » (ADR-020, étendu #166) ───────────────────
// Lieu créer-ou-piocher + N lignes logement, chacune occupée (occupant + bail)
// ou encore libre (logement seul → `available`, Journey 5). Réutilise
// exactement les mêmes normalizers ; renvoie le payload de la RPC
// bulk_onboard_portfolio(p_property, p_rows).
export type BailRowInput = {
  occupied: string // "1" = occupant + bail requis ; "0" = logement seul
  unitName: string
  unitType: string
  firstName: string
  lastName: string
  phone: string
  email: string
  monthlyRentAmount: string
  dueDay: string
  startDate: string
}

export type BailFormInput = {
  propertyMode: string // "existing" | "new"
  propertyId: string
  propertyName: string
  propertyCity: string
  rows: BailRowInput[]
}

export type BailPropertyPayload = { id: string } | { name: string; city?: string }

export type BailValidation =
  | { ok: true; property: BailPropertyPayload; rows: BulkRpcRow[] }
  | { ok: false; formError: string; rowIndex: number | null }

export function validateBailForm(input: BailFormInput): BailValidation {
  let property: BailPropertyPayload
  if (input.propertyMode === "existing") {
    if (isBlank(input.propertyId)) {
      return { ok: false, formError: "Choisissez un lieu ou créez-en un.", rowIndex: null }
    }
    property = { id: input.propertyId.trim() }
  } else {
    const name = normalizePropertyName(input.propertyName)
    if (!name) {
      return { ok: false, formError: "Donnez un nom au lieu (2 caractères minimum).", rowIndex: null }
    }
    const city = normalizeOptionalPropertyText(input.propertyCity, 80)
    property = city ? { name, city } : { name }
  }

  if (input.rows.length === 0) {
    return { ok: false, formError: "Ajoutez au moins un logement.", rowIndex: null }
  }

  const rows: BulkRpcRow[] = []
  for (let i = 0; i < input.rows.length; i += 1) {
    // « Ligne N » seulement en saisie multiple : le cas mono garde ses
    // messages d'origine, sans jargon de lot.
    const prefix = input.rows.length > 1 ? `Ligne ${i + 1} : ` : ""
    const fail = (message: string): BailValidation => ({
      ok: false,
      formError: `${prefix}${message}`,
      rowIndex: i,
    })
    const r = input.rows[i]

    const unitName = normalizeUnitName(r.unitName)
    if (!unitName) return fail("Donnez un nom simple au logement.")
    const unitType = normalizeUnitType(r.unitType)
    if (!unitType) return fail("Choisissez le type de logement.")

    // Logement encore libre (Journey 5) : la RPC crée le logement en
    // `available`, sans locataire ni bail.
    if (r.occupied !== "1") {
      rows.push({ unit_name: unitName, unit_type: unitType })
      continue
    }

    const firstName = normalizeTenantName(r.firstName)
    if (!firstName) return fail("Prénom de l'occupant requis.")
    const lastName = normalizeTenantName(r.lastName)
    if (!lastName) return fail("Nom de l'occupant requis.")
    const phone = normalizeTenantPhone(r.phone)
    if (!phone) return fail("Numéro Bénin invalide (ex. +229 01 23 45 67 89).")
    if (!isBlank(r.email) && !isEmail(r.email.trim())) {
      return fail("Adresse email invalide.")
    }

    const amount = normalizeRentAmount(r.monthlyRentAmount)
    if (!amount) return fail("Loyer mensuel invalide (montant positif).")
    const dueDay = normalizeDueDay(r.dueDay)
    if (!dueDay) return fail("Le jour d'échéance doit être compris entre 1 et 31.")
    const startDate = normalizeDate(r.startDate)
    if (!startDate) return fail("Date de début invalide.")

    const row: BulkRpcRow = {
      unit_name: unitName,
      unit_type: unitType,
      first_name: firstName,
      last_name: lastName,
      phone,
      monthly_rent_amount: String(amount),
      due_day: String(dueDay),
      start_date: startDate,
    }
    if (!isBlank(r.email)) row.email = r.email.trim()
    rows.push(row)
  }

  return { ok: true, property, rows }
}
