// Champs cibles de l'import de portefeuille — les clés attendues par les RPC
// validate_portfolio_import / import_portfolio (migration 20260809120600).
// Les libellés sont ceux vus par l'agence ; les alias servent à reconnaître
// automatiquement ses propres en-têtes, qu'elle ne renommera pas.

export const IMPORT_FIELD_KEYS = [
  "owner_name",
  "owner_phone",
  "owner_email",
  "owner_fee_rate_bp",
  "property_name",
  "property_city",
  "property_address",
  "unit_name",
  "unit_type",
  "unit_notes",
  "tenant_first_name",
  "tenant_last_name",
  "tenant_phone",
  "tenant_email",
  "monthly_rent_amount",
  "currency",
  "due_day",
  "start_date",
  "end_date",
] as const

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number]

// Une ligne prête pour la RPC : toutes les valeurs en texte, vide = absent.
export type ImportRow = Record<ImportFieldKey, string>

export type ImportFieldGroup = "Mandant" | "Bien" | "Lot" | "Locataire" | "Bail"

export type ImportField = {
  key: ImportFieldKey
  label: string
  group: ImportFieldGroup
  // Obligatoire pour que la ligne soit importable.
  required?: boolean
  // Libellés d'en-tête reconnus, du plus précis au plus large.
  aliases: string[]
}

export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "property_name",
    label: "Bien",
    group: "Bien",
    required: true,
    aliases: [
      "nom du bien",
      "bien",
      "immeuble",
      "residence",
      "cour",
      "batiment",
      "propriete",
      "ensemble",
      "site",
      "adresse du bien",
      "nom de l immeuble",
      "villa",
      "concession",
      "property",
      "building",
    ],
  },
  {
    key: "property_city",
    label: "Ville",
    group: "Bien",
    aliases: ["ville", "commune", "localite", "city", "ville du bien"],
  },
  {
    key: "property_address",
    label: "Adresse ou repère",
    group: "Bien",
    aliases: [
      "adresse",
      "repere",
      "rue",
      "quartier",
      "localisation",
      "situation",
      "address",
    ],
  },
  {
    key: "unit_name",
    label: "Lot",
    group: "Lot",
    required: true,
    aliases: [
      "lot",
      "nom du lot",
      "numero du lot",
      "logement",
      "appartement",
      "appart",
      "chambre",
      "studio",
      "local",
      "porte",
      "unite",
      "boutique",
      "magasin",
      "unit",
    ],
  },
  {
    key: "unit_type",
    label: "Type de lot",
    group: "Lot",
    aliases: [
      "type de lot",
      "type",
      "nature",
      "categorie",
      "type de bien",
      "type de logement",
      "usage",
    ],
  },
  {
    key: "unit_notes",
    label: "Note sur le lot",
    group: "Lot",
    aliases: ["note", "notes", "observation", "observations", "remarque", "commentaire"],
  },
  {
    key: "owner_name",
    label: "Propriétaire",
    group: "Mandant",
    aliases: [
      "proprietaire",
      "nom du proprietaire",
      "proprio",
      "bailleur",
      "mandant",
      "mandataire",
      "owner",
      "compte de",
      "pour le compte de",
    ],
  },
  {
    key: "owner_phone",
    label: "Téléphone du propriétaire",
    group: "Mandant",
    aliases: [
      "telephone du proprietaire",
      "tel proprietaire",
      "contact proprietaire",
      "portable proprietaire",
      "numero proprietaire",
      "telephone bailleur",
      "tel mandant",
    ],
  },
  {
    key: "owner_email",
    label: "E-mail du propriétaire",
    group: "Mandant",
    aliases: [
      "email du proprietaire",
      "mail proprietaire",
      "courriel proprietaire",
      "email bailleur",
      "email mandant",
    ],
  },
  {
    key: "owner_fee_rate_bp",
    label: "Taux d'honoraires (%)",
    group: "Mandant",
    aliases: [
      "taux d honoraires",
      "honoraires",
      "taux de gestion",
      "frais de gestion",
      "commission",
      "taux",
      "pourcentage de gestion",
    ],
  },
  {
    key: "tenant_first_name",
    label: "Prénom du locataire",
    group: "Locataire",
    aliases: ["prenom", "prenom du locataire", "prenom locataire", "first name"],
  },
  {
    key: "tenant_last_name",
    label: "Nom du locataire",
    group: "Locataire",
    aliases: [
      "nom du locataire",
      "nom locataire",
      "locataire",
      "occupant",
      "nom",
      "patronyme",
      "last name",
      "tenant",
    ],
  },
  {
    key: "tenant_phone",
    label: "Téléphone du locataire",
    group: "Locataire",
    aliases: [
      "telephone du locataire",
      "telephone",
      "tel",
      "portable",
      "mobile",
      "contact",
      "numero",
      "whatsapp",
      "gsm",
      "phone",
    ],
  },
  {
    key: "tenant_email",
    label: "E-mail du locataire",
    group: "Locataire",
    aliases: ["email du locataire", "email", "mail", "courriel", "adresse email"],
  },
  {
    key: "monthly_rent_amount",
    label: "Loyer mensuel",
    group: "Bail",
    aliases: [
      "loyer",
      "loyer mensuel",
      "montant du loyer",
      "montant",
      "loyer hors charges",
      "prix",
      "rent",
    ],
  },
  {
    key: "currency",
    label: "Devise",
    group: "Bail",
    aliases: ["devise", "monnaie", "currency"],
  },
  {
    key: "due_day",
    label: "Jour d'échéance",
    group: "Bail",
    aliases: [
      "jour d echeance",
      "jour de paiement",
      "echeance",
      "jour",
      "jour du mois",
      "due day",
    ],
  },
  {
    key: "start_date",
    label: "Début du bail",
    group: "Bail",
    aliases: [
      "date de debut",
      "debut du bail",
      "debut",
      "date d entree",
      "entree",
      "depuis",
      "start date",
    ],
  },
  {
    key: "end_date",
    label: "Fin du bail",
    group: "Bail",
    aliases: ["date de fin", "fin du bail", "fin", "date de sortie", "sortie", "end date"],
  },
]

export const IMPORT_FIELD_GROUPS: ImportFieldGroup[] = [
  "Bien",
  "Lot",
  "Mandant",
  "Locataire",
  "Bail",
]

export const REQUIRED_FIELD_KEYS: ImportFieldKey[] = IMPORT_FIELDS.filter(
  (field) => field.required,
).map((field) => field.key)

export function importFieldLabel(key: ImportFieldKey): string {
  return IMPORT_FIELDS.find((field) => field.key === key)?.label ?? key
}

export function emptyImportRow(): ImportRow {
  return Object.fromEntries(IMPORT_FIELD_KEYS.map((key) => [key, ""])) as ImportRow
}
