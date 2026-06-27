"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Server Action : le locataire confirme avoir payé son loyer
// Appelée depuis /confirmer/[token]
// ============================================================

export async function confirmRentPayment(rentDueId: string) {
  const supabase = await createClient();

  // 1. Récupérer l'échéance pour avoir les infos nécessaires
  const { data: rentDue, error: fetchError } = await supabase
    .from("rent_dues")
    .select("id, landlord_id, tenant_id, unit_id, period_start, period_end, amount_due, currency, status")
    .eq("id", rentDueId)
    .maybeSingle();

  if (fetchError || !rentDue) {
    return { ok: false, message: "Échéance introuvable." };
  }

  if (rentDue.status === "paid" || rentDue.status === "cancelled") {
    return { ok: false, message: "Cette échéance est déjà traitée." };
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
      return { ok: false, message: "Ce loyer a déjà été confirmé par le propriétaire." };
    }
    if (existing.status === "draft") {
      return { ok: false, message: "Vous avez déjà déclaré ce paiement. Le propriétaire va le vérifier." };
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
      payment_method: "tenant_declared", // Le locataire déclare, le proprio précisera
      status: "draft",
      received_at: new Date().toISOString(),
      note: "Déclaré par le locataire — en attente de validation du propriétaire.",
    });

  if (insertError) {
    console.error("confirmRentPayment: insert failed", insertError.code, insertError.message);
    return { ok: false, message: "Impossible d'enregistrer votre déclaration. Réessayez." };
  }

  // 4. Mettre à jour le statut de l'échéance
  await supabase
    .from("rent_dues")
    .update({ status: "pending_confirmation" })
    .eq("id", rentDueId);

  // 5. Revalider le cache
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Votre déclaration a été enregistrée. Le propriétaire va la vérifier.",
  };
}
