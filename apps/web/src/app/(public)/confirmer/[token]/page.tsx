import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { confirmRentPayment } from "./actions";

// ============================================================
// Page de confirmation locataire — publique, zéro auth
// Le locataire arrive via le lien dans le SMS (ranti.app/c/[token])
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

export default async function ConfirmerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Valider le format du token (UUID)
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    notFound();
  }

  // Chercher l'échéance correspondante
  const { data: rentDue, error } = await supabase
    .from("rent_dues")
    .select(
      "id, amount_due, currency, due_date, period_start, period_end, status, unit:units(name), tenant:tenants(first_name, last_name)",
    )
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error || !rentDue) {
    notFound();
  }

  // Vérifier si déjà confirmé ou payé
  const { data: existingReception } = await supabase
    .from("rent_receptions")
    .select("id, status")
    .eq("unit_id", (rentDue as any).unit?.id)
    .eq("tenant_id", (rentDue as any).tenant?.id)
    .gte("received_at", rentDue.period_start)
    .lte("received_at", rentDue.period_end)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const alreadyDraft = existingReception?.status === "draft";
  const alreadyConfirmed = existingReception?.status === "confirmed";

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
          {(rentDue as any).unit?.name || "Logement"}
        </p>

        {/* Détails de l'échéance */}
        <div className="mt-8 space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Locataire</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {(rentDue as any).tenant?.first_name}{" "}
              {(rentDue as any).tenant?.last_name}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Période</span>
            <span className="text-neutral-900 dark:text-neutral-100">
              {formatDate(rentDue.period_start)} –{" "}
              {formatDate(rentDue.period_end)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Échéance</span>
            <span className="text-neutral-900 dark:text-neutral-100">
              {formatDate(rentDue.due_date)}
            </span>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold dark:border-neutral-700">
            <span className="text-neutral-700 dark:text-neutral-300">Montant</span>
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
          ) : alreadyDraft ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                Votre déclaration a bien été enregistrée. Le propriétaire va la vérifier.
              </p>
            </div>
          ) : rentDue.status === "paid" ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                Cette échéance est déjà marquée comme payée.
              </p>
            </div>
          ) : (
            <form action={confirmRentPayment.bind(null, rentDue.id)}>
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                J&apos;ai payé ce loyer
              </button>
              <p className="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
                En cliquant, vous confirmez avoir payé votre loyer.
                Le propriétaire validera cette déclaration.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
