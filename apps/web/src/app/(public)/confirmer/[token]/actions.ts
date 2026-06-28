"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Server Action : le locataire confirme avoir payé son loyer
// Appelée depuis /confirmer/[token]
// ============================================================

export async function confirmRentPayment(rentDueId: string, token: string) {
  const supabase = await createClient();

  // 1. Récupérer l'échéance pour avoir les infos nécessaires
  const { data: rentDue, error: fetchError } = await supabase
    .from("rent_dues")
    .select("id, landlord_id, tenant_id, unit_id, period_start, period_end, amount_due, currency, status, confirmation_token")
    .eq("id", rentDueId)
    .maybeSingle();

  if (fetchError || !rentDue) {
    redirect(`/confirmer/${token}?error=not_found`);
  }

  // Vérifier que le token de l'URL correspond bien au token de l'échéance
  if (rentDue.confirmation_token !== token) {
    redirect(`/confirmer/${token}?error=invalid_token`);
  }

  if (rentDue.status === "paid" || rentDue.status === "cancelled") {
    redirect(`/confirmer/${token}?error=already_processed`);
  }

  // 2. Vérifier qu'il n'y a pas déjà une déclaration pour cette période
  const { data: existing } = await supabase
    .from("rent_receptions")
    .select("id, status")
    .eq("unit_id", rentDue.unit_id)
    .eq("tenant_id", rentDue.tenant_id)
    .gte("received_at", rentDue.period_start)
    .lte("received_at", rentDue.period_end)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === "confirmed") {
      redirect(`/confirmer/${token}?error=already_confirmed`);
    }
    if (existing.status === "draft") {
      redirect(`/confirmer/${token}?error=already_declared`);
    }
  }

  // 3. Créer la réception en statut 'draft'
  const { error: insertError } = await supabase
    .from("rent_receptions")
    .insert({
      landlord_id: rentDue.landlord_id,
      tenant_id: rentDue.tenant_id,
      unit_id: rentDue.unit_id,
      amount_received: rentDue.amount_due,
      currency: rentDue.currency,
      payment_method: "other", // Locataire déclare — le proprio précisera lors de la validation
      status: "draft",
      received_at: new Date().toISOString(),
      note: "Déclaré par le locataire — en attente de validation du propriétaire.",
    });

  if (insertError) {
    console.error("confirmRentPayment: insert failed", insertError.code, insertError.message);
    redirect(`/confirmer/${token}?error=insert_failed`);
  }

  // 4. Revalider le cache et rediriger
  revalidatePath("/", "layout");
  redirect(`/confirmer/${token}?success=1`);
}
