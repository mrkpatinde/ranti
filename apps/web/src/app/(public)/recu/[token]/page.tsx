import { notFound } from "next/navigation";
import { formatFcfa } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { RantiLogo } from "@/components/ranti-logo";
import { createClient } from "@/lib/supabase/server";
import type { ReceiptByToken } from "@/lib/receipts/types";
import { certifyReceipt } from "./actions";
import { ContestForm } from "./contest-form";

// ============================================================
// Reçu partagé — page publique, zéro auth (ADR-013).
// Les données viennent de la RPC SECURITY DEFINER get_receipt_by_token,
// qui pose aussi l'état `read` à la première ouverture. L'anon ne lit
// aucune table directement.
// ============================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Reçu introuvable.",
  cancelled: "Ce reçu a été annulé par le propriétaire.",
  already_certified: "Vous avez déjà confirmé ce reçu.",
  disputed: "Ce reçu est déjà en contestation.",
  already_disputed: "Ce reçu est déjà en contestation. Votre première version est conservée.",
  invalid_nature: "Indiquez ce qui ne va pas.",
  amount_invalid: "Montant invalide.",
  period_invalid: "Période trop longue.",
  action_failed: "Action impossible pour le moment. Réessayez.",
};

const KIND_LABEL: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
};

const NATURE_LABEL: Record<string, string> = {
  amount: "Montant contesté",
  date: "Période contestée",
  not_paid: "Paiement contesté",
};

export default async function RecuPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  if (!UUID_RE.test(token)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_receipt_by_token", {
    p_token: token,
  });

  const receipt = (data as ReceiptByToken[] | null)?.[0];
  if (error || !receipt) {
    notFound();
  }

  const errorMsg =
    typeof sp.error === "string" ? (ERROR_MESSAGES[sp.error] ?? null) : null;
  const justCertified = sp.certified === "1";
  const justContested = sp.contested === "1";

  const kind = KIND_LABEL[receipt.kind] ?? "Document";
  const docNoun = receipt.kind === "quittance" ? "quittance" : "reçu";
  const tenantName =
    [receipt.tenant_first_name, receipt.tenant_last_name]
      .filter(Boolean)
      .join(" ") || "Locataire";
  const landlordName =
    [receipt.landlord_first_name, receipt.landlord_last_name]
      .filter(Boolean)
      .join(" ") || "Propriétaire";

  const canAct =
    receipt.status !== "cancelled" &&
    receipt.tenant_ack !== "certified" &&
    receipt.tenant_ack !== "disputed";

  const isCertified = receipt.tenant_ack === "certified";
  const isDisputed = receipt.tenant_ack === "disputed";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-stretch px-4 py-10 [font-variant-numeric:tabular-nums] sm:py-14">
      {/* En-tête : marque + lien vérifié (pas de kicker majuscule — DESIGN.md) */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <RantiLogo size={30} />
          <div className="leading-none">
            <p className="font-display text-lg font-extrabold tracking-tight text-foreground">
              Ranti
            </p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              Registre de loyer
            </p>
          </div>
        </div>
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Lien vérifié
        </span>
      </header>

      {/* Accueil chaleureux tant que le locataire peut agir */}
      {canAct && (
        <div className="mb-4">
          <h1 className="font-display text-[1.7rem] font-extrabold leading-tight tracking-tight text-foreground">
            Bonjour {receipt.tenant_first_name || tenantName}, votre {docNoun} est
            disponible.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {landlordName} a enregistré votre paiement. Vérifiez, puis confirmez la
            réception — c&apos;est gratuit et sans compte.
          </p>
        </div>
      )}

      {/* Bandeau confirmé — coche dans un cercle olive */}
      {isCertified && (
        <div className="mb-4 flex items-start gap-3 rounded-[19px] border border-accent/40 bg-secondary px-4 py-3.5">
          <span className="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" aria-hidden="true">
              <path
                d="M5 12.5l4 4 10-10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {kind} confirmée — merci.
            </span>
            <span className="text-[0.82rem] leading-snug text-muted-foreground">
              Votre confirmation est enregistrée dans le registre. Gardez ce lien :
              il reste votre preuve.
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-[19px] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {errorMsg}
        </div>
      )}
      {justCertified && (
        <div className="mb-4 rounded-[19px] border border-accent/25 bg-secondary px-5 py-4 text-sm text-foreground">
          Merci. Vous avez confirmé l&apos;exactitude de ce reçu.
        </div>
      )}
      {justContested && (
        <div className="mb-4 rounded-[19px] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          Votre contestation est enregistrée. Le propriétaire en est informé.
        </div>
      )}
      {isDisputed && (
        <div className="mb-4 rounded-[19px] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {kind} contestée — votre version est enregistrée à côté de celle du
          propriétaire.
        </div>
      )}

      {/* Document */}
      <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_1px_2px_rgba(41,41,41,0.05),0_18px_40px_-18px_rgba(41,41,41,0.20)]">
        <div className="flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                {kind}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                N° {receipt.receipt_number} · émis le {formatDate(receipt.issued_at)}
              </p>
            </div>
            {isCertified ? (
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Confirmée
              </span>
            ) : isDisputed ? (
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                Contestée
              </span>
            ) : receipt.status === "cancelled" ? (
              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Annulée
              </span>
            ) : (
              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                À confirmer
              </span>
            )}
          </div>

          {/* Détails */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between gap-4">
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Propriétaire
              </span>
              <span className="text-right text-sm font-medium text-foreground">
                {landlordName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Locataire
              </span>
              <span className="text-right text-sm font-medium text-foreground">
                {tenantName}
              </span>
            </div>
            {receipt.unit_name && (
              <div className="flex justify-between gap-4">
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Logement
                </span>
                <span className="text-right text-sm font-medium text-foreground">
                  {receipt.unit_name}
                </span>
              </div>
            )}
          </div>

          {receipt.allocations.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Périodes réglées
              </p>
              {receipt.allocations.map((a, i) => (
                <div key={i} className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="text-foreground">
                    {formatDate(a.period_start)} – {formatDate(a.period_end)}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatFcfa(a.amount_allocated)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-4">
            <span className="text-sm font-semibold text-foreground">
              Montant réglé
            </span>
            <span className="font-display text-[1.6rem] font-extrabold tracking-tight text-foreground">
              {formatFcfa(receipt.total_amount)}
            </span>
          </div>

          {/* Version du locataire si contesté (deux voix) */}
          {isDisputed && receipt.contest_nature && (
            <div className="rounded-[15px] border border-destructive/25 bg-destructive/[0.06] p-4">
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-destructive">
                {NATURE_LABEL[receipt.contest_nature]}
              </p>
              <p className="mt-2 text-sm text-foreground">
                {receipt.contest_nature === "not_paid" &&
                  "Le locataire déclare ne pas avoir payé ce loyer."}
                {receipt.contest_nature === "amount" &&
                  `Le locataire déclare avoir payé ${
                    receipt.contested_amount != null
                      ? formatFcfa(receipt.contested_amount)
                      : "un autre montant"
                  }.`}
                {receipt.contest_nature === "date" &&
                  `Le locataire indique une autre période : ${
                    receipt.contested_period || "non précisée"
                  }.`}
              </p>
            </div>
          )}

          {/* Empreinte d'intégrité si certifié */}
          {isCertified && receipt.sha256_fingerprint && (
            <p className="break-all text-[0.75rem] leading-relaxed text-muted-foreground">
              Intégrité — empreinte SHA-256 :{" "}
              <span className="font-mono text-[0.72rem] text-foreground">
                {receipt.sha256_fingerprint}
              </span>
            </p>
          )}
        </div>

        {/* Pied d'action */}
        {(canAct || receipt.status !== "cancelled") && (
          <div className="flex flex-col gap-3 border-t border-border bg-muted px-6 py-5 sm:px-7">
            {canAct && (
              <>
                <form action={certifyReceipt.bind(null, token)}>
                  <SubmitButton
                    className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-accent-foreground shadow-[0_1px_2px_rgba(91,111,0,0.22),0_8px_20px_-8px_rgba(91,111,0,0.38)] transition hover:brightness-105 disabled:opacity-60"
                    pendingLabel="Envoi…"
                  >
                    Confirmer la réception
                  </SubmitButton>
                </form>
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  En confirmant, vous attestez que ce loyer a bien été réglé. Votre
                  confirmation est ajoutée au registre.
                </p>
                <ContestForm token={token} />
              </>
            )}
            {receipt.status !== "cancelled" && (
              <a
                href={`/recu/${token}/pdf`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Télécharger en PDF
              </a>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        Ranti documente qui a payé, qui doit, et la preuve. Il ne touche jamais
        l&apos;argent et ne tranche pas les litiges.
      </p>
    </main>
  );
}
