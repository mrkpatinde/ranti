import "server-only"

import { formatFcfa } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

// Reconstitution de l'ecran de prise en main a partir de la BASE.
//
// Sans ca, un bailleur qui rechargeait /first-run retrouvait un ecran vide
// alors que son bail existait deja : il pouvait le ressaisir et se creer un
// doublon de logement et de locataire sur son premier contact avec le produit.
//
// Le bail principal est celui marque `created_during_onboarding` (migration
// 20260727180010). Les autres sont les bails « ajoutes ». On ne devine rien :
// un bailleur sans bail marque n'a simplement pas de principal.

export type FirstRunLeaseSeed = {
  leaseId: string
  unitId: string
  tenantId: string
  dueId: string | null
  dueAmount: number
  name: string
  home: string
  amount: string
  status: "due" | "paid"
}

export type FirstRunSeed = {
  primary: FirstRunLeaseSeed | null
  added: FirstRunLeaseSeed[]
}

type LeaseRow = {
  id: string
  unit_id: string
  tenant_id: string
  monthly_rent_amount: number
  created_during_onboarding: boolean
  units: { name: string | null; properties: { city: string | null } | null } | null
  tenants: { first_name: string | null; last_name: string | null } | null
}

type DueRow = {
  id: string
  lease_id: string
  unit_id: string
  tenant_id: string
  amount_due: number
  status: string
}

const EMPTY: FirstRunSeed = { primary: null, added: [] }

export async function getFirstRunSeed(landlordId: string): Promise<FirstRunSeed> {
  const supabase = await createClient()

  const { data: leases, error } = await supabase
    .from("leases")
    .select(
      "id, unit_id, tenant_id, monthly_rent_amount, created_during_onboarding, units(name, properties(city)), tenants(first_name, last_name)",
    )
    .eq("landlord_id", landlordId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  // Panne de lecture : on rend un ecran vide plutot que de bloquer la prise en
  // main. C'est le comportement d'avant ce correctif, degrade mais jamais pire.
  if (error || !leases || leases.length === 0) return EMPTY

  const rows = leases as unknown as LeaseRow[]

  // Echeance non soldee la plus ancienne par bail : c'est la cible
  // d'allocation que l'ecran propose d'encaisser.
  const { data: dues } = await supabase
    .from("rent_dues")
    .select("id, lease_id, unit_id, tenant_id, amount_due, status")
    .in(
      "lease_id",
      rows.map((r) => r.id),
    )
    .is("deleted_at", null)
    .order("period_start", { ascending: true })

  const openDueByLease = new Map<string, DueRow>()
  for (const d of (dues ?? []) as DueRow[]) {
    if (d.status === "paid" || d.status === "cancelled") continue
    if (!openDueByLease.has(d.lease_id)) openDueByLease.set(d.lease_id, d)
  }

  function toSeed(row: LeaseRow): FirstRunLeaseSeed {
    const due = openDueByLease.get(row.id) ?? null
    const tenantName = [row.tenants?.first_name, row.tenants?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
    const home = [row.units?.name, row.units?.properties?.city].filter(Boolean).join(", ")
    const amount = due?.amount_due ?? row.monthly_rent_amount

    return {
      leaseId: row.id,
      unitId: due?.unit_id ?? row.unit_id,
      tenantId: due?.tenant_id ?? row.tenant_id,
      dueId: due?.id ?? null,
      dueAmount: amount,
      name: tenantName || "Locataire",
      home: home || "Logement",
      amount: formatFcfa(amount),
      // Aucune echeance ouverte = tout est solde pour ce bail.
      status: due ? "due" : "paid",
    }
  }

  const primaryRow = rows.find((r) => r.created_during_onboarding) ?? null

  return {
    primary: primaryRow ? toSeed(primaryRow) : null,
    added: rows.filter((r) => r !== primaryRow).map(toSeed),
  }
}
