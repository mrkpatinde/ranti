"use server"

import { redirect } from "next/navigation"
import { revalidateMoneySurfaces } from "@/lib/cache/money"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"

function readString(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === "string" && v ? v : null
}

// Generate (or top up) the monthly dues of a lease. Idempotent (migration 009).
export async function generateRentDues(formData: FormData) {
  await requireLandlordProfile()

  const leaseId = readString(formData, "lease_id")
  if (!leaseId) {
    redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("generate_rent_dues", { p_lease_id: leaseId })

  if (error) {
    if (error.code === "P0002") {
      redirect(`/leases?error=${encodeURIComponent("Bail introuvable.")}`)
    }
    redirect(`/leases/${leaseId}?error=${encodeURIComponent("Génération impossible. Réessayez.")}`)
  }

  revalidateMoneySurfaces()
  redirect(`/leases/${leaseId}?notice=dues_generated`)
}

// Cancel a due with a trace. Refused if a confirmed reception is allocated to it.
export async function cancelRentDue(formData: FormData) {
  await requireLandlordProfile()

  const id = readString(formData, "id")
  if (!id) {
    redirect(`/dashboard?error=${encodeURIComponent("Échéance introuvable.")}`)
  }

  const reason = readString(formData, "reason")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_rent_due", {
    p_rent_due_id: id,
    p_reason: reason,
  })

  if (error) {
    let message = "Annulation impossible. Réessayez."
    if (error.code === "P0002") message = "Échéance introuvable."
    else if (error.code === "P0001") {
      message = "Cette échéance est réglée ou liée à un encaissement confirmé."
    }
    redirect(`/dashboard?error=${encodeURIComponent(message)}`)
  }

  // Une échéance annulée sort des cibles de relance et du journal ; la fiche
  // bail la montre barrée. leaseId absent ici : le motif dynamique suffit.
  revalidateMoneySurfaces()
  redirect(`/dashboard?notice=rent_due_cancelled`)
}
