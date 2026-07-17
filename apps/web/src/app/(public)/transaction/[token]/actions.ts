"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseChargeContestInput } from "@/lib/ledger/contest";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Actions publiques de la ligne de compte partagée (ADR-023 §7).
// Le locataire valide, conteste, ou retire sa contestation. Toute la
// logique (token, machine à états, deux voix) vit dans les RPC
// SECURITY DEFINER : l'anon n'accède à aucune table.
// ============================================================

export async function validateCharge(token: string) {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("validate_ledger_line_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("validateCharge: rpc failed", error.code, error.message);
    redirect(`/transaction/${token}?error=action_failed`);
  }
  if (result !== "ok") {
    redirect(`/transaction/${token}?error=${result}`);
  }

  revalidatePath("/", "layout");
  redirect(`/transaction/${token}?validated=1`);
}

export async function contestCharge(token: string, formData: FormData) {
  const supabase = await createClient();

  const parsed = parseChargeContestInput({
    nature: String(formData.get("nature") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    comment: String(formData.get("comment") ?? ""),
  });

  if (!parsed.ok) {
    redirect(`/transaction/${token}?error=${parsed.error}`);
  }

  const { data: result, error } = await supabase.rpc("contest_ledger_line_by_token", {
    p_token: token,
    p_nature: parsed.nature,
    p_amount: parsed.amount,
    p_comment: parsed.comment,
  });

  if (error) {
    console.error("contestCharge: rpc failed", error.code, error.message);
    redirect(`/transaction/${token}?error=action_failed`);
  }
  if (result !== "ok") {
    redirect(`/transaction/${token}?error=${result}`);
  }

  revalidatePath("/", "layout");
  redirect(`/transaction/${token}?contested=1`);
}

export async function retractContest(token: string) {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("retract_contest_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("retractContest: rpc failed", error.code, error.message);
    redirect(`/transaction/${token}?error=action_failed`);
  }
  if (result !== "ok") {
    redirect(`/transaction/${token}?error=${result}`);
  }

  revalidatePath("/", "layout");
  redirect(`/transaction/${token}?retracted=1`);
}
