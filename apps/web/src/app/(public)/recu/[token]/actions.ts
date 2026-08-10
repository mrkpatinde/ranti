"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ERECEIPT_CONSENT_WORDING } from "@/lib/receipts/consent";
import { parseContestInput } from "@/lib/receipts/contest";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Actions publiques du reçu partagé (ADR-013).
// Le locataire certifie ou conteste. Toute la logique (validation token,
// transitions d'état, empreinte, version locataire) vit dans les RPC
// SECURITY DEFINER : l'anon n'accède à aucune table.
//
// Consentement quittance électronique (v2, 2026-08-10) : plus d'écran séparé.
// L'accord est enregistré au moment de la confirmation — grant PUIS certify.
// La RPC grant_ereceipt_consent est write-once et idempotente (un rejeu
// renvoie l'horodatage d'origine) : l'appeler à chaque certification est
// sûr, la trace tenant_consents reste immuable (trigger).
// ============================================================

export async function certifyReceipt(token: string) {
  const supabase = await createClient();

  // 1. L'accord d'abord : la confirmation vaut acceptation de la remise
  // électronique (libellé affiché sous le bouton, archivé verbatim). Sans
  // accord enregistré, on ne certifie pas — jamais d'accord fantôme.
  const { error: consentError } = await supabase.rpc("grant_ereceipt_consent", {
    p_token: token,
    p_wording: ERECEIPT_CONSENT_WORDING,
  });

  if (consentError) {
    console.error("certifyReceipt: consent rpc failed", consentError.code, consentError.message);
    redirect(`/recu/${token}?error=action_failed`);
  }

  // 2. Puis la certification (deuxième voix, ADR-013).
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

  // Pas de consentement requis pour contester : signaler une erreur n'est pas
  // accepter la remise électronique de ses quittances.
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
