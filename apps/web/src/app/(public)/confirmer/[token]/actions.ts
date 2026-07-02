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

export async function confirmRentPayment(token: string) {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc(
    "declare_rent_payment_by_token",
    { p_token: token },
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
