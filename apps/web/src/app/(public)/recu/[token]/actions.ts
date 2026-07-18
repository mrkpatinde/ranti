"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseContestInput } from "@/lib/receipts/contest";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Actions publiques du reçu partagé (ADR-013).
// Le locataire certifie ou conteste un reçu déjà émis. Toute la logique
// (validation token, transitions d'état, empreinte, version locataire)
// vit dans les RPC SECURITY DEFINER : l'anon n'accède à aucune table.
// ============================================================

export async function certifyReceipt(token: string) {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("certify_receipt_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("certifyReceipt: rpc failed", error.code, error.message);
    redirect(`/recu/${token}?error=action_failed`);
  }
  if (result !== "ok") {
    redirect(`/recu/${token}?error=${result}`);
  }

  revalidatePath("/", "layout");
  // Pas de query param : le bandeau d'état persistant (tenant_ack) suffit.
  redirect(`/recu/${token}`);
}

export async function contestReceipt(token: string, formData: FormData) {
  const supabase = await createClient();

  const parsed = parseContestInput({
    nature: String(formData.get("nature") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    period: String(formData.get("period") ?? ""),
  });

  if (!parsed.ok) {
    redirect(`/recu/${token}?error=${parsed.error}`);
  }

  const { data: result, error } = await supabase.rpc("contest_receipt_by_token", {
    p_token: token,
    p_nature: parsed.nature,
    p_amount: parsed.amount,
    p_period: parsed.period,
  });

  if (error) {
    console.error("contestReceipt: rpc failed", error.code, error.message);
    redirect(`/recu/${token}?error=action_failed`);
  }
  if (result !== "ok") {
    redirect(`/recu/${token}?error=${result}`);
  }

  revalidatePath("/", "layout");
  // Pas de query param : le bandeau d'état persistant (tenant_ack) suffit.
  redirect(`/recu/${token}`);
}
