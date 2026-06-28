import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { confirmRentPayment } from "./actions";

// ============================================================
// Page de confirmation locataire — publique, zéro auth
// ============================================================

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Échéance introuvable.",
  invalid_token: "Lien de confirmation invalide.",
  already_processed: "Cette échéance est déjà traitée.",
  already_confirmed: "Ce loyer a déjà été confirmé par le propriétaire.",
  already_declared: "Vous avez déjà déclaré ce paiement. Le propriétaire va le vérifier.",
  insert_failed: "Impossible d'enregistrer votre déclaration. Réessayez.",
};

export default async function ConfirmerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    notFound();
  }

  const { data: rentDue, error } = await supabase
    .from("rent_dues")
    .select(
      "id, amount_due, currency, due_date, period_start, period_end, status, unit_id, tenant_id, unit:units(name), tenant:tenants(first_name, last_name)",
    )
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error || !rentDue) {
    notFound();
  }

  // Vérifier si déjà une déclaration existe pour cette période
  const { data: existingReception } = await supabase
    .from("rent_receptions")
    .select("id, status")
    .eq("unit_id", rentDue.unit_id)
    .eq("tenant_id", rentDue.tenant_id)
    .gte("received_at", rentDue.period_start)
    .lte("received_at", rentDue.period_end)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const alreadyDraft = existingReception?.status === "draft";
  const alreadyConfirmed = existingReception?.status === "confirmed";
  const success = sp.success === "1";
  const errorMsg = typeof sp.error === "string" ? (ERROR_MESSAGES[sp.error] ?? null) : null;

  // Noms pour l'affichage (issus des jointures Supabase)
  type RentDueJoined = typeof rentDue & {
    unit?: { name?: string } | null;
    tenant?: { first_name?: string; last_name?: string } | null;
  };
  const joined = rentDue as RentDueJoined;
  const unitName = joined.unit?.name || "Logement";
  const tenantDisplay = joined.tenant
    ? `${joined.tenant.first_name} ${joined.tenant.last_name}`
    : "Locataire";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
          Ranti
        </p>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          Confirmation de loyer
        </h1>

        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {unitName}
        </p>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Message de succès */}
        {success && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            Votre déclaration a été enregistrée. Le propriétaire va la vérifier.
          </div>
        )}

        {/* Détails de l'échéance */}
        <div className="mt-8 space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Locataire
            </span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {tenantDisplay}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Période
            </span>
            <span className="text-neutral-900 dark:text-neutral-100">
              {formatDate(rentDue.period_start)} –{" "}
              {formatDate(rentDue.period_end)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Échéance
            </span>
            <span className="text-neutral-900 dark:text-neutral-100">
              {formatDate(rentDue.due_date)}
            </span>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold dark:border-neutral-700">
            <span className="text-neutral-700 dark:text-neutral-300">
              Montant
            </span>
            <span className="text-lg text-neutral-950 dark:text-neutral-50">
              {formatAmount(rentDue.amount_due)}
            </span>
          </div>
        </div>

        {/* État actuel */}
        <div className="mt-8">
          {alreadyConfirmed ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                Le propriétaire a confirmé la réception de ce loyer.
              </p>
            </div>
          ) : alreadyDraft || success ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                Votre déclaration a bien été enregistrée. Le propriétaire va la
                vérifier.
              </p>
            </div>
          ) : rentDue.status === "paid" ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                Cette échéance est déjà marquée comme payée.
              </p>
            </div>
          ) : (
            <form action={confirmRentPayment.bind(null, rentDue.id, token)}>
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                J&apos;ai payé ce loyer
              </button>
              <p className="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
                En cliquant, vous confirmez avoir payé votre loyer. Le
                propriétaire validera cette déclaration.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
