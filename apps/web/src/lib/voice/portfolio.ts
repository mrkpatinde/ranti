import { getLandlordLeases } from "@/lib/leases"
import { getLandlordTenants } from "@/lib/tenants"
import { getLandlordUnits } from "@/lib/units"
import type { VoicePortfolioLease } from "./types"

// Contexte "effet Granola" : les baux actifs du propriétaire, aplatis avec le
// nom du locataire et du logement, pour que Gemini résolve une phrase libre
// ("Koffi a payé son loyer de juillet") vers un lease_id précis.
export async function getVoicePortfolio(landlordId: string): Promise<VoicePortfolioLease[]> {
  const [leases, units, tenants] = await Promise.all([
    getLandlordLeases(landlordId),
    getLandlordUnits(landlordId),
    getLandlordTenants(landlordId),
  ])

  const unitName = (id: string): string => units.find((u) => u.id === id)?.name ?? "Logement"
  const tenantName = (id: string): string => {
    const t = tenants.find((x) => x.id === id)
    return t ? `${t.first_name} ${t.last_name}` : "Locataire"
  }

  return leases
    .filter((lease) => lease.status === "active")
    .map((lease) => ({
      lease_id: lease.id,
      tenant_name: tenantName(lease.tenant_id),
      unit_name: unitName(lease.unit_id),
      monthly_rent: lease.monthly_rent_amount,
    }))
}
