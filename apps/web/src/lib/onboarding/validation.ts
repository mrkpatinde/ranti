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

// ── Écran unique « Créer un bail » (ADR-020) ────────────────────────────────
// Lieu créer-ou-piocher + logement + occupant (toujours requis) + bail, en un
// geste. Réutilise exactement les mêmes normalizers ; renvoie le payload de la
// RPC bulk_onboard_portfolio(p_property, p_rows) avec une seule ligne occupée.
export type BailFormInput = {
  propertyMode: string // "existing" | "new"
  propertyId: string
  propertyName: string
  propertyCity: string
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

export type BailPropertyPayload = { id: string } | { name: string; city?: string }

export type BailValidation =
  | { ok: true; property: BailPropertyPayload; row: BulkRpcRow }
  | { ok: false; formError: string }

export function validateBailForm(input: BailFormInput): BailValidation {
  let property: BailPropertyPayload
  if (input.propertyMode === "existing") {
    if (isBlank(input.propertyId)) {
      return { ok: false, formError: "Choisissez un lieu ou créez-en un." }
    }
    property = { id: input.propertyId.trim() }
  } else {
    const name = normalizePropertyName(input.propertyName)
    if (!name) return { ok: false, formError: "Donnez un nom au lieu (2 caractères minimum)." }
    const city = normalizeOptionalPropertyText(input.propertyCity, 80)
    property = city ? { name, city } : { name }
  }

  const unitName = normalizeUnitName(input.unitName)
  if (!unitName) return { ok: false, formError: "Donnez un nom simple au logement." }
  const unitType = normalizeUnitType(input.unitType)
  if (!unitType) return { ok: false, formError: "Choisissez le type de logement." }

  const firstName = normalizeTenantName(input.firstName)
  if (!firstName) return { ok: false, formError: "Prénom de l'occupant requis." }
  const lastName = normalizeTenantName(input.lastName)
  if (!lastName) return { ok: false, formError: "Nom de l'occupant requis." }
  const phone = normalizeTenantPhone(input.phone)
  if (!phone) return { ok: false, formError: "Numéro Bénin invalide (ex. +229 01 23 45 67 89)." }
  if (!isBlank(input.email) && !isEmail(input.email.trim())) {
    return { ok: false, formError: "Adresse email invalide." }
  }

  const amount = normalizeRentAmount(input.monthlyRentAmount)
  if (!amount) return { ok: false, formError: "Loyer mensuel invalide (montant positif)." }
  const dueDay = normalizeDueDay(input.dueDay)
  if (!dueDay) return { ok: false, formError: "Le jour d'échéance doit être compris entre 1 et 31." }
  const startDate = normalizeDate(input.startDate)
  if (!startDate) return { ok: false, formError: "Date de début invalide." }

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
  if (!isBlank(input.email)) row.email = input.email.trim()

  return { ok: true, property, row }
}
