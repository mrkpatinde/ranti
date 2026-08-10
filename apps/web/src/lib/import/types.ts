// Types partagés entre l'écran d'import (client) et les actions serveur.

import type { ImportRow } from "./fields"

export type { ImportRow }

// Verdict d'une ligne renvoyé par validate_portfolio_import.
export type ValidationLine = {
  line: number
  unit_label: string
  errors: string[]
}

// Récapitulatif chiffré renvoyé par import_portfolio.
export type ImportSummary = {
  owners_created: number
  properties_created: number
  units_created: number
  tenants_created: number
  leases_activated: number
  rent_dues_generated: number
}

export type ValidateResult =
  | { ok: true; lines: ValidationLine[] }
  | { ok: false; message: string }

export type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; message: string }

// Plafond d'une tentative. Au-delà, l'agence coupe son fichier : un import de
// 400 lignes en une transaction est déjà bien au-delà du portefeuille cible.
export const MAX_IMPORT_ROWS = 400
