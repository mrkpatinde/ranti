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
