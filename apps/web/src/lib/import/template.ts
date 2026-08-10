// Modèle de fichier proposé au téléchargement. Généré ici, à la demande : un
// fichier statique de plus dans /public se désynchroniserait des champs.
// Point-virgule + BOM : c'est ce qu'Excel francophone ouvre sans écran
// d'import intermédiaire.

import type { ImportFieldKey } from "./fields"

const TEMPLATE_DELIMITER = ";"

export const TEMPLATE_COLUMNS: { key: ImportFieldKey; label: string }[] = [
  { key: "owner_name", label: "Propriétaire" },
  { key: "owner_phone", label: "Téléphone du propriétaire" },
  { key: "owner_email", label: "E-mail du propriétaire" },
  { key: "owner_fee_rate_bp", label: "Taux d'honoraires (%)" },
  { key: "property_name", label: "Bien" },
  { key: "property_city", label: "Ville" },
  { key: "property_address", label: "Adresse ou repère" },
  { key: "unit_name", label: "Lot" },
  { key: "unit_type", label: "Type de lot" },
  { key: "unit_notes", label: "Note sur le lot" },
  { key: "tenant_first_name", label: "Prénom du locataire" },
  { key: "tenant_last_name", label: "Nom du locataire" },
  { key: "tenant_phone", label: "Téléphone du locataire" },
  { key: "tenant_email", label: "E-mail du locataire" },
  { key: "monthly_rent_amount", label: "Loyer mensuel" },
  { key: "due_day", label: "Jour d'échéance" },
  { key: "start_date", label: "Début du bail" },
  { key: "end_date", label: "Fin du bail" },
]

// Deux exemples : un lot occupé (bail activé à l'import) et un lot vacant du
// même bien — le cas le plus courant d'un portefeuille réel, et celui qu'on
// croit à tort impossible à importer.
const TEMPLATE_ROWS: string[][] = [
  [
    "Awa Diallo",
    "+229 01 96 00 00 00",
    "awa.diallo@example.com",
    "8,5",
    "Résidence Fifadji",
    "Cotonou",
    "Rue 12.45, face à la pharmacie",
    "A1",
    "Appartement",
    "",
    "Aïcha",
    "Kossou",
    "+229 01 90 00 00 00",
    "",
    "125000",
    "5",
    "01/03/2026",
    "",
  ],
  [
    "Awa Diallo",
    "",
    "",
    "",
    "Résidence Fifadji",
    "Cotonou",
    "Rue 12.45, face à la pharmacie",
    "A2",
    "Chambre",
    "Lot vacant : ni locataire, ni bail",
    "",
    "",
    "",
    "",
    "80000",
    "5",
    "",
    "",
  ],
]

function escapeCell(value: string): string {
  return /["\n\r;,\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function toCsvLine(cells: string[]): string {
  return cells.map(escapeCell).join(TEMPLATE_DELIMITER)
}

/** Contenu du modèle, BOM UTF-8 inclus. */
export function buildTemplateCsv(): string {
  const lines = [
    toCsvLine(TEMPLATE_COLUMNS.map((column) => column.label)),
    ...TEMPLATE_ROWS.map(toCsvLine),
  ]

  return `\uFEFF${lines.join("\r\n")}\r\n`
}

export const TEMPLATE_FILE_NAME = "modele-portefeuille-ranti.csv"
