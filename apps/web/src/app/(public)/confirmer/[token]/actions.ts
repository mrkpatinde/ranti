"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Server Action : le locataire confirme avoir payé son loyer
// Appelée depuis /confirmer/[token]
// Toute la logique (validation token, doublons, insertion draft)
// vit dans la RPC SECURITY DEFINER declare_rent_payment_by_token :
// le client anon n'a aucun accès direct aux tables.
// ============================================================

const VALID_METHODS = ["mobile_money", "cash", "bank_transfer", "other"] as const;

export async function confirmRentPayment(token: string, formData: FormData) {
  const supabase = await createClient();

  const methodRaw = String(formData.get("method") ?? "");
  const method = (VALID_METHODS as readonly string[]).includes(methodRaw)
    ? methodRaw
    : null;
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!method) {
    redirect(`/confirmer/${token}?error=method_invalid`);
  }
  // La référence de transaction est exigée pour les paiements traçables :
  // c'est elle qui permet au propriétaire de vérifier avant de confirmer.
  if ((method === "mobile_money" || method === "bank_transfer") && !reference) {
    redirect(`/confirmer/${token}?error=reference_required`);
  }
  if (reference && reference.length > 120) {
    redirect(`/confirmer/${token}?error=reference_invalid`);
  }

  const { data: result, error } = await supabase.rpc(
    "declare_rent_payment_by_token",
    { p_token: token, p_method: method, p_reference: reference },
  );

  if (error) {
    console.error("confirmRentPayment: rpc failed", error.code, error.message);
    redirect(`/confirmer/${token}?error=insert_failed`);
  }

  if (result !== "ok") {
    redirect(`/confirmer/${token}?error=${result}`);
  }

  revalidatePath("/", "layout");
  redirect(`/confirmer/${token}?success=1`);
}
