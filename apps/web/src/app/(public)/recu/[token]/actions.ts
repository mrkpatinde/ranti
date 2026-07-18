"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ERECEIPT_CONSENT_WORDING } from "@/lib/receipts/consent";
import { parseContestInput } from "@/lib/receipts/contest";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Actions publiques du reçu partagé (ADR-013).
// Le locataire consent (une fois), certifie ou conteste. Toute la logique
// (validation token, transitions d'état, empreinte, version locataire)
// vit dans les RPC SECURITY DEFINER : l'anon n'accède à aucune table.
// ============================================================

// Consentement à la quittance électronique (conformité) : UNE fois par
// locataire, write-once côté DB (rejeu = même horodatage), libellé archivé
// verbatim. Après accord, la page se recharge et affiche le document.
export async function grantEreceiptConsent(token: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("grant_ereceipt_consent", {
    p_token: token,
    p_wording: ERECEIPT_CONSENT_WORDING,
  });

  if (error) {
    console.error("grantEreceiptConsent: rpc failed", error.code, error.message);
    redirect(`/recu/${token}?error=action_failed`);
  }

  redirect(`/recu/${token}`);
}

// Garde partagée : certifier ou contester présuppose une quittance REMISE,
// donc consentie. Un POST direct sans accord retombe sur l'écran de
// consentement (redirect vers la page).
async function requireConsentOrRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
) {
  const { data } = await supabase.rpc("ereceipt_consent_status", { p_token: token });
  const consent = (data as { found: boolean; granted_at: string | null }[] | null)?.[0];
  if (!consent || !consent.found || !consent.granted_at) {
    redirect(`/recu/${token}`);
  }
}

export async function certifyReceipt(token: string) {
  const supabase = await createClient();
  await requireConsentOrRedirect(supabase, token);

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
  await requireConsentOrRedirect(supabase, token);

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
