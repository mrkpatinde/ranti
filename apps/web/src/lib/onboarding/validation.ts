// Validation de l'onboarding groupé (plusieurs logements + locataires + baux).
// Aucune règle métier nouvelle : on réutilise les normalizers existants de
// units / tenants / leases pour rester 100% conforme aux formulaires unitaires.

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

// Champs partagés, saisis une fois en entête du formulaire.
export type BulkShared = {
  propertyId: string
  unitType: string
  dueDay: string
}

// Une ligne telle que saisie côté client (chaînes brutes).
export type BulkRawRow = {
  unitName: string
  firstName: string
  lastName: string
  phone: string
  email: string
  monthlyRentAmount: string
  startDate: string
}

// Une ligne prête pour la RPC (valeurs texte, castées côté SQL).
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

export type RowError = { row: number; field: string; message: string }

export type BulkValidation =
  | { ok: true; rows: BulkRpcRow[] }
  | { ok: false; formError?: string; rowErrors: RowError[] }

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === ""
}

const TENANT_FIELDS: (keyof BulkRawRow)[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "monthlyRentAmount",
  "startDate",
]

// Une ligne est « vide » si aucun champ n'est renseigné : on l'ignore
// (lignes de fin laissées vides par le propriétaire).
function isEmptyRow(raw: BulkRawRow): boolean {
  return isBlank(raw.unitName) && TENANT_FIELDS.every((f) => isBlank(raw[f]))
}

// Le bloc locataire est « tout ou rien » : présent dès qu'un champe locataire
// (hors email seul) est renseigné.
function hasTenantBlock(raw: BulkRawRow): boolean {
  return (
    !isBlank(raw.firstName) ||
    !isBlank(raw.lastName) ||
    !isBlank(raw.phone) ||
    !isBlank(raw.monthlyRentAmount) ||
    !isBlank(raw.startDate)
  )
}

export function validateBulkOnboarding(
  shared: BulkShared,
  rawRows: BulkRawRow[],
): BulkValidation {
  const rowErrors: RowError[] = []

  if (isBlank(shared.propertyId)) {
    return { ok: false, formError: "Choisissez la propriété concernée.", rowErrors }
  }

  const unitType = normalizeUnitType(shared.unitType)
  if (!unitType) {
    return { ok: false, formError: "Choisissez le type de logement.", rowErrors }
  }

  const sharedDueDay = normalizeDueDay(shared.dueDay)
  if (!sharedDueDay) {
    return {
      ok: false,
      formError: "Le jour d'échéance doit être compris entre 1 et 31.",
      rowErrors,
    }
  }

  const rows: BulkRpcRow[] = []

  rawRows.forEach((raw, index) => {
    if (isEmptyRow(raw)) return
    const rowNo = index + 1

    const unitName = normalizeUnitName(raw.unitName)
    if (!unitName) {
      rowErrors.push({
        row: rowNo,
        field: "unitName",
        message: "Donnez un nom simple à ce logement.",
      })
    }

    const rpcRow: BulkRpcRow = {
      unit_name: unitName ?? "",
      unit_type: unitType,
    }

    if (hasTenantBlock(raw)) {
      // Bloc locataire complet requis.
      const firstName = normalizeTenantName(raw.firstName)
      const lastName = normalizeTenantName(raw.lastName)
      const phone = normalizeTenantPhone(raw.phone)
      const amount = normalizeRentAmount(raw.monthlyRentAmount)
      const startDate = normalizeDate(raw.startDate)

      if (!firstName)
        rowErrors.push({ row: rowNo, field: "firstName", message: "Prénom du locataire requis." })
      if (!lastName)
        rowErrors.push({ row: rowNo, field: "lastName", message: "Nom du locataire requis." })
      if (!phone)
        rowErrors.push({
          row: rowNo,
          field: "phone",
          message: "Numéro Bénin invalide (ex. +229 01 23 45 67 89).",
        })
      if (!amount)
        rowErrors.push({
          row: rowNo,
          field: "monthlyRentAmount",
          message: "Loyer mensuel invalide (montant positif).",
        })
      if (!startDate)
        rowErrors.push({
          row: rowNo,
          field: "startDate",
          message: "Date de début invalide.",
        })

      if (!isBlank(raw.email) && !isEmail(raw.email.trim())) {
        rowErrors.push({ row: rowNo, field: "email", message: "Adresse email invalide." })
      }

      rpcRow.first_name = firstName ?? ""
      rpcRow.last_name = lastName ?? ""
      rpcRow.phone = phone ?? ""
      if (!isBlank(raw.email)) rpcRow.email = raw.email.trim()
      rpcRow.monthly_rent_amount = amount ? String(amount) : ""
      rpcRow.due_day = String(sharedDueDay)
      rpcRow.start_date = startDate ?? ""
    }

    rows.push(rpcRow)
  })

  if (rowErrors.length > 0) {
    return { ok: false, rowErrors }
  }

  if (rows.length === 0) {
    return { ok: false, formError: "Ajoutez au moins un logement.", rowErrors }
  }

  return { ok: true, rows }
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
