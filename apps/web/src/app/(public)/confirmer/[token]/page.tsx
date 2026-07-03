import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { confirmRentPayment } from "./actions";

// ============================================================
// Page de confirmation locataire — publique, zéro auth.
// Les données viennent de la RPC SECURITY DEFINER
// get_rent_due_by_token : l'anon ne lit aucune table directement.
// ============================================================

type RentDueByToken = {
  id: string;
  amount_due: number;
  amount_remaining: number;
  currency: string;
  due_date: string;
  period_start: string;
  period_end: string;
  status: string;
  unit_name: string | null;
  tenant_first_name: string | null;
  declaration_status: string | null;
};

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

  const { data, error } = await supabase.rpc("get_rent_due_by_token", {
    p_token: token,
  });

  const rentDue = (data as RentDueByToken[] | null)?.[0];
  if (error || !rentDue) {
    notFound();
  }

  const alreadyDraft = rentDue.declaration_status === "draft";
  const alreadyConfirmed = rentDue.declaration_status === "confirmed";
  const success = sp.success === "1";
  const errorMsg = typeof sp.error === "string" ? (ERROR_MESSAGES[sp.error] ?? null) : null;

  const unitName = rentDue.unit_name || "Logement";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Ranti
        </p>

        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
          Confirmation de loyer
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {unitName}
        </p>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Message de succès */}
        {success && (
          <div className="mt-4 rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
            Votre déclaration a été enregistrée. Le propriétaire va la vérifier.
          </div>
        )}

        {/* Détails de l'échéance */}
        <div className="mt-8 space-y-4 rounded-2xl border border-border bg-background p-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Locataire
            </span>
            <span className="font-medium text-foreground">
              {rentDue.tenant_first_name || "Locataire"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Période
            </span>
            <span className="text-foreground">
              {formatDate(rentDue.period_start)} –{" "}
              {formatDate(rentDue.period_end)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Échéance
            </span>
            <span className="text-foreground">
              {formatDate(rentDue.due_date)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span className="text-foreground/80">
              {rentDue.amount_remaining < rentDue.amount_due
                ? "Reste à payer"
                : "Montant à confirmer"}
            </span>
            <span className="text-lg text-foreground">
              {formatAmount(rentDue.amount_remaining)}
            </span>
          </div>
        </div>

        {/* État actuel */}
        <div className="mt-8">
          {alreadyConfirmed ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
                Le propriétaire a confirmé la réception de ce loyer.
              </p>
            </div>
          ) : alreadyDraft || success ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-accent-foreground">
                Votre déclaration a bien été enregistrée. Le propriétaire va la
                vérifier.
              </p>
            </div>
          ) : rentDue.status === "paid" ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">
                Cette échéance est déjà marquée comme payée.
              </p>
            </div>
          ) : (
            <form action={confirmRentPayment.bind(null, token)}>
              <SubmitButton
                className="inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                pendingLabel="Envoi…"
              >
                J&apos;ai payé ce loyer
              </SubmitButton>
              <p className="mt-4 text-center text-xs text-muted-foreground">
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
