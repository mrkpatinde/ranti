// Propriétaire mandant : la personne pour le compte de qui l'agence gère des
// lots. Ce n'est pas un utilisateur — il ne se connecte jamais, il reçoit un
// relevé (migration 20260809120500).
export type Owner = {
  id: string
  landlord_id: string
  display_name: string
  phone: string | null
  email: string | null
  // Honoraires en points de base (800 = 8 %). Jamais affiché tel quel :
  // l'interface parle en pourcentage (lib/owners/validation.ts).
  fee_rate_bp: number
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Ligne de la vue owner_month_summary : la clôture du mois en cours.
export type OwnerMonthSummary = {
  owner_id: string
  landlord_id: string
  display_name: string
  fee_rate_bp: number
  units: number
  collected: number
  fee: number
  net_due_to_owner: number
}

// Un mandant sans bien n'apparaît pas dans la vue (jointure interne) : on
// complète alors par des zéros plutôt que de le faire disparaître de la liste.
export type OwnerWithMonth = Owner & {
  units: number
  collected: number
  fee: number
  net_due_to_owner: number
}
