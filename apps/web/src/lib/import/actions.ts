"use server"

import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { IMPORT_FIELD_KEYS, emptyImportRow, type ImportRow } from "./fields"
import {
  MAX_IMPORT_ROWS,
  type ImportResult,
  type ImportSummary,
  type ValidateResult,
  type ValidationLine,
} from "./types"

const MAX_CELL_LENGTH = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Le client envoie du JSON : on ne fait confiance ni aux clés, ni aux types,
// ni à la longueur. Seules les clés attendues par la RPC survivent.
function sanitizeRows(rows: unknown): ImportRow[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  if (rows.length > MAX_IMPORT_ROWS) return null

  const clean: ImportRow[] = []

  for (const raw of rows) {
    if (typeof raw !== "object" || raw === null) return null
    const source = raw as Record<string, unknown>
    const row = emptyImportRow()

    for (const key of IMPORT_FIELD_KEYS) {
      const value = source[key]
      if (typeof value !== "string") continue
      row[key] = value.trim().slice(0, MAX_CELL_LENGTH)
    }

    clean.push(row)
  }

  return clean
}

// error.code = SQLSTATE remonté par la RPC ; message = « ligne N: <détail> »
// pour les erreurs d'insertion, ou « validation_failed: … » pour le barrage.
function importErrorMessage(error: { code?: string; message?: string }): string {
  const message = error.message ?? ""
  const line = message.match(/ligne (\d+)/)
  const prefix = line ? `Ligne ${line[1]} : ` : ""

  if (message.includes("validation_failed")) {
    return "Des lignes sont encore à corriger. Reprenez l'aperçu."
  }
  if (message.includes("import_in_progress")) {
    return "Cet import est déjà en cours. Patientez quelques secondes avant de réessayer."
  }

  switch (error.code) {
    case "P0002":
      return "Profil introuvable. Reconnectez-vous, puis reprenez l'import."
    case "23505":
      return `${prefix}ce lot existe déjà dans votre portefeuille.`
    case "23P01":
      return `${prefix}ce lot a déjà un bail actif sur cette période.`
    case "23502":
      return `${prefix}informations du locataire incomplètes (prénom, nom et téléphone).`
    case "23514":
      return `${prefix}valeur invalide (loyer ou jour d'échéance).`
    case "P0001":
      return `${prefix}import impossible en l'état. Vérifiez les lignes signalées.`
    default:
      return `${prefix}import impossible. Réessayez dans un instant.`
  }
}

/**
 * Aperçu : demande à la base son verdict ligne par ligne, sans rien écrire.
 * Renvoie la liste complète (lignes valides comprises) pour que l'écran
 * affiche « X prêtes, Y à corriger ».
 */
export async function validateImportRows(rows: unknown): Promise<ValidateResult> {
  await requireLandlordProfile()

  const clean = sanitizeRows(rows)
  if (!clean) {
    return {
      ok: false,
      message: `Fichier vide ou trop volumineux (${MAX_IMPORT_ROWS} lignes maximum par import).`,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("validate_portfolio_import", { p_rows: clean })

  if (error) {
    console.error("validateImportRows: RPC failed", error.code, error.message)
    return { ok: false, message: importErrorMessage(error) }
  }

  const lines = ((data ?? []) as ValidationLine[]).map((line) => ({
    line: line.line,
    unit_label: line.unit_label ?? "",
    errors: line.errors ?? [],
  }))

  return { ok: true, lines }
}

/**
 * Import réel : tout-ou-rien côté base, idempotent par requestId — un double
 * clic ou une reprise réseau renvoie le même récapitulatif au lieu de créer
 * le portefeuille deux fois.
 */
export async function runPortfolioImport(
  rows: unknown,
  requestId: unknown,
): Promise<ImportResult> {
  await requireLandlordProfile()

  const clean = sanitizeRows(rows)
  if (!clean) {
    return {
      ok: false,
      message: `Fichier vide ou trop volumineux (${MAX_IMPORT_ROWS} lignes maximum par import).`,
    }
  }

  const key = typeof requestId === "string" && UUID_RE.test(requestId.trim())
    ? requestId.trim()
    : null

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_portfolio", {
    p_rows: clean,
    p_request_id: key,
  })

  if (error) {
    console.error("runPortfolioImport: RPC failed", error.code, error.message)
    return { ok: false, message: importErrorMessage(error) }
  }

  // L'import active des baux et génère des échéances : purge des surfaces
  // argent, comme toute écriture du registre.
  revalidateMoneySurfaces()

  const summary = (data ?? {}) as Partial<ImportSummary>

  return {
    ok: true,
    summary: {
      owners_created: summary.owners_created ?? 0,
      properties_created: summary.properties_created ?? 0,
      units_created: summary.units_created ?? 0,
      tenants_created: summary.tenants_created ?? 0,
      leases_activated: summary.leases_activated ?? 0,
      rent_dues_generated: summary.rent_dues_generated ?? 0,
    },
  }
}
