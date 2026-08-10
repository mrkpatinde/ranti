// Relances par lot — logique pure, sans I/O.
//
// Relancer bail par bail (ouvrir l'échéance, cliquer, revenir) tient sur deux
// logements, pas sur soixante lots. Ici : la file complète, un message
// pré-rédigé par ligne à partir d'un modèle unique, et un envoi séquentiel.
// Ranti n'envoie rien lui-même — le message part du WhatsApp du gestionnaire
// via un lien wa.me (ADR-006, art. 6 des CGU).

import { formatFcfa, monthYearLabel } from "@/lib/format"

/** Une ligne de la vue `reminder_batch` (migration 20260809120800). */
export type ReminderBatchRow = {
  rent_due_id: string
  lease_id: string
  tenant_id: string
  owner_id: string | null
  owner_name: string | null
  property_name: string | null
  unit_name: string | null
  tenant_name: string | null
  tenant_phone: string | null
  period_start: string
  period_end: string
  due_date: string
  currency: string
  amount_remaining: number
  /** Jours écoulés depuis l'échéance : positif = en retard. */
  days_from_due: number
  reminder_type: "j_5" | "j_1" | "late_j_1" | "late_j_3"
  last_reminder_at: string | null
  reminder_count: number | null
}

export const reminderTypeLabels: Record<ReminderBatchRow["reminder_type"], string> = {
  j_5: "Avant l'échéance",
  j_1: "Veille de l'échéance",
  late_j_1: "En retard",
  late_j_3: "En retard",
}

// ── Modèle de message ───────────────────────────────────────────────────────

export const DEFAULT_BATCH_TEMPLATE =
  "Bonjour {locataire}, le loyer de {lot} pour {période} reste dû : {montant}."

/** Champs substituables, affichés sous le modèle. */
export const TEMPLATE_PLACEHOLDERS = [
  "locataire",
  "lot",
  "bien",
  "période",
  "montant",
  "échéance",
  "retard",
] as const

function frDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** Valeurs de substitution d'une ligne de la file. */
export function buildTemplateVars(row: ReminderBatchRow): Record<string, string> {
  const late = Math.max(0, row.days_from_due)

  return {
    locataire: row.tenant_name?.trim() || "Madame, Monsieur",
    lot: row.unit_name?.trim() || "votre logement",
    bien: row.property_name?.trim() || "",
    période: monthYearLabel(row.period_start) ?? "",
    montant: formatFcfa(row.amount_remaining),
    échéance: frDate(row.due_date),
    retard: late === 1 ? "1 jour" : `${late} jours`,
  }
}

/**
 * Substitue les `{champs}` du modèle. Un champ inconnu est laissé tel quel :
 * le gestionnaire voit sa faute de frappe plutôt qu'un trou dans le message.
 */
export function renderReminderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{([^{}]*)\}/g, (match, name: string) => {
    const key = name.trim()
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  })
}

export function renderRowMessage(row: ReminderBatchRow, template: string): string {
  return renderReminderTemplate(template, buildTemplateVars(row))
}

/** Les messages du lot, indexés par échéance — forme attendue par la RPC
 *  `log_reminder_batch(p_messages jsonb)`. */
export function buildBatchMessages(
  rows: ReminderBatchRow[],
  template: string,
): Record<string, string> {
  const messages: Record<string, string> = {}
  for (const row of rows) {
    messages[row.rent_due_id] = renderRowMessage(row, template)
  }
  return messages
}

// ── Sélection ───────────────────────────────────────────────────────────────

/** Coche ou décoche une ligne. */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
}

/** true si toutes les lignes données sont cochées (et qu'il y en a au moins une). */
export function isFullySelected(selected: readonly string[], ids: readonly string[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.includes(id))
}

/**
 * « Tout sélectionner » d'un groupe ou de la file entière : coche tout ce qui
 * manque, ou décoche l'ensemble si tout était déjà coché.
 */
export function toggleAll(selected: readonly string[], ids: readonly string[]): string[] {
  if (isFullySelected(selected, ids)) {
    const drop = new Set(ids)
    return selected.filter((id) => !drop.has(id))
  }
  const known = new Set(selected)
  return [...selected, ...ids.filter((id) => !known.has(id))]
}

/** Les lignes cochées, dans l'ordre de la file (pas celui des clics). */
export function orderedSelection(
  rows: ReminderBatchRow[],
  selected: readonly string[],
): ReminderBatchRow[] {
  const picked = new Set(selected)
  return rows.filter((row) => picked.has(row.rent_due_id))
}

// ── Regroupement ────────────────────────────────────────────────────────────

export type ReminderGroupBy = "owner" | "property"

export type ReminderGroup = {
  key: string
  label: string
  rows: ReminderBatchRow[]
}

/** Groupe la file par mandant ou par bien, ordre d'apparition conservé. */
export function groupReminderRows(
  rows: ReminderBatchRow[],
  by: ReminderGroupBy,
): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>()

  for (const row of rows) {
    const label =
      by === "owner"
        ? row.owner_name?.trim() || "Sans mandant"
        : row.property_name?.trim() || "Sans bien"
    const key = by === "owner" ? (row.owner_id ?? "sans-mandant") : label

    const group = groups.get(key)
    if (group) group.rows.push(row)
    else groups.set(key, { key, label, rows: [row] })
  }

  return [...groups.values()]
}
