import { formatFcfa } from "@/lib/format"
import { notFound } from "next/navigation";
import { RantiLogo } from "@/components/ranti-logo";
import { SubmitButton } from "@/components/submit-button";
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

const ACK_BANNER: Record<
  ReceiptByToken["tenant_ack"],
  { text: string; cls: string }
> = {
  unilateral: {
    text: "Déclaration du propriétaire — en attente de votre confirmation.",
    cls: "border-border bg-muted text-foreground",
  },
  read: {
    text: "Vous avez ouvert ce reçu. Confirmez son exactitude ou signalez une erreur.",
    cls: "border-border bg-muted text-foreground",
  },
  certified: {
    text: "Reçu certifié — vous en avez confirmé l'exactitude.",
    cls: "border-primary/20 bg-secondary text-foreground",
  },
  disputed: {
    text: "Reçu contesté — votre version est enregistrée à côté de celle du propriétaire.",
    cls: "border-destructive/25 bg-destructive/10 text-destructive",
  },
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

  const ack = ACK_BANNER[receipt.tenant_ack];
  // Un SEUL bandeau d'état : juste après l'action (?certified=1 / ?contested=1),
  // son texte devient le remerciement — pas d'encadré séparé qui répète la
  // même chose que l'état persistant.
  const ackText =
    justCertified && receipt.tenant_ack === "certified"
      ? "Merci. Vous avez confirmé l'exactitude de ce reçu."
      : justContested && receipt.tenant_ack === "disputed"
        ? "Votre contestation est enregistrée. Le propriétaire en est informé."
        : ack.text;
  const kind = KIND_LABEL[receipt.kind] ?? "Document";
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-2.5">
          <RantiLogo size={28} />
          <span className="font-display text-lg font-extrabold tracking-tight text-foreground">Ranti</span>
          <span className="text-sm text-muted-foreground">· Reçu partagé</span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
          {kind}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          N° {receipt.receipt_number} · émis le {formatDate(receipt.issued_at)}
        </p>

        {receipt.status !== "cancelled" ? (
          <a
            href={`/recu/${token}/pdf`}
            className="mt-4 inline-flex rounded-full border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:border-foreground"
          >
            Télécharger le PDF
          </a>
        ) : null}

        {/* Bandeau d'acquittement */}
        <div className={`mt-6 rounded-2xl border px-5 py-4 text-sm ${ack.cls}`}>
          {ackText}
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* Détails */}
        <div className="mt-8 space-y-4 rounded-2xl border border-border bg-background p-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Propriétaire</span>
            <span className="font-medium text-foreground">{landlordName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Locataire</span>
            <span className="font-medium text-foreground">{tenantName}</span>
          </div>
          {receipt.unit_name && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Logement</span>
              <span className="text-foreground">{receipt.unit_name}</span>
            </div>
          )}
          {receipt.allocations.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Périodes réglées
              </p>
              {receipt.allocations.map((a, i) => (
                <div key={i} className="mt-2 flex justify-between text-sm">
                  <span className="text-foreground">
                    {formatDate(a.period_start)} – {formatDate(a.period_end)}
                  </span>
                  <span className="text-foreground">{formatFcfa(a.amount_allocated)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span className="text-foreground/80">Total</span>
            <span className="text-lg text-foreground">
              {formatFcfa(receipt.total_amount)}
            </span>
          </div>
        </div>

        {/* Version du locataire si contesté (deux voix) */}
        {receipt.tenant_ack === "disputed" && receipt.contest_nature && (
          <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/10 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-destructive">
              {NATURE_LABEL[receipt.contest_nature]}
            </p>
            <p className="mt-2 text-sm text-destructive">
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
        {receipt.tenant_ack === "certified" && receipt.sha256_fingerprint && (
          <p className="mt-6 break-all text-center text-xs text-muted-foreground">
            Empreinte d&apos;intégrité (SHA-256) :{" "}
            <span className="font-mono">{receipt.sha256_fingerprint}</span>
          </p>
        )}

        {/* Actions */}
        {canAct && (
          <div className="mt-8 space-y-3">
            <form action={certifyReceipt.bind(null, token)}>
              <SubmitButton
                className="inline-flex w-full justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60"
                pendingLabel="Envoi…"
              >
                Confirmer l&apos;exactitude
              </SubmitButton>
            </form>
            <ContestForm token={token} />
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ranti documente qui a payé, qui doit, et la preuve. Il ne tranche pas
          les litiges.
        </p>
      </div>
    </main>
  );
}
