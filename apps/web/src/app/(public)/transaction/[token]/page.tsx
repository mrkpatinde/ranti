import { formatFcfa } from "@/lib/format";
import { notFound } from "next/navigation";
import { RantiLogo } from "@/components/ranti-logo";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import type { LedgerLineByToken } from "@/lib/ledger/types";
import { retractContest, validateCharge } from "./actions";
import { ContestForm } from "./contest-form";

// ============================================================
// Ligne de compte partagée — page publique, zéro auth (ADR-023 §7).
// Le locataire valide ou conteste une somme affirmée par le propriétaire.
// Les données viennent de la RPC SECURITY DEFINER get_ledger_line_by_token ;
// l'anon ne lit aucune table directement. Modèle ADR-013 reconduit.
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
  not_found: "Ligne introuvable.",
  withdrawn: "Cette somme a été retirée par le propriétaire.",
  already_validated: "Vous avez déjà validé cette somme.",
  disputed: "Cette somme est déjà en contestation.",
  already_disputed: "Cette somme est déjà en contestation. Votre première version est conservée.",
  not_disputed: "Cette somme n'est pas en contestation.",
  invalid_nature: "Indiquez ce qui ne va pas.",
  amount_invalid: "Montant invalide.",
  comment_too_long: "Votre message est trop long (500 caractères maximum).",
  action_failed: "Action impossible pour le moment. Réessayez.",
};

const TYPE_LABEL: Record<string, string> = {
  reparation: "Réparation",
  frais: "Frais",
  loyer: "Loyer",
  reglement: "Règlement",
  contre_passation: "Correction",
};

const NATURE_LABEL: Record<string, string> = {
  amount: "Montant contesté",
  not_owed: "Dette non reconnue",
  already_paid: "Déjà réglée selon vous",
  other: "Désaccord signalé",
};

export default async function TransactionPage({
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
  const { data, error } = await supabase.rpc("get_ledger_line_by_token", {
    p_token: token,
  });

  const line = (data as LedgerLineByToken[] | null)?.[0];
  if (error || !line) {
    notFound();
  }

  const errorMsg =
    typeof sp.error === "string" ? (ERROR_MESSAGES[sp.error] ?? null) : null;
  const justValidated = sp.validated === "1";
  const justContested = sp.contested === "1";
  const justRetracted = sp.retracted === "1";

  // Un SEUL bandeau d'état ; juste après l'action, son texte devient le
  // remerciement (même doctrine que /recu, critique design 2026-07-16).
  const banner =
    line.status === "pending"
      ? {
          text: "Votre propriétaire a ajouté cette somme à votre compte loyer. Validez-la ou signalez une erreur.",
          cls: "border-border bg-muted text-foreground",
        }
      : line.status === "validated"
        ? {
            text:
              justValidated
                ? "Merci. Vous avez validé cette somme — elle entre au compte du bail."
                : justRetracted
                  ? "Contestation retirée. La somme est validée et entre au compte du bail."
                  : line.resolution === "retrait_contestation"
                    ? "Somme validée après retrait de votre contestation."
                    : "Somme validée — vous l'avez confirmée.",
            cls: "border-primary/20 bg-secondary text-foreground",
          }
        : line.status === "disputed"
          ? {
              text: justContested
                ? "Votre contestation est enregistrée. Le propriétaire en est informé."
                : "Somme contestée — votre version est enregistrée à côté de celle du propriétaire.",
              cls: "border-warning/50 bg-warning/10 text-warning",
            }
          : {
              text:
                line.resolution === "remplacement"
                  ? "Cette somme a été corrigée par le propriétaire — un nouveau lien vous a été envoyé."
                  : "Cette somme a été retirée par le propriétaire. Elle ne compte pas dans votre solde.",
              cls: "border-border bg-muted text-muted-foreground",
            };

  const landlordName =
    [line.landlord_first_name, line.landlord_last_name].filter(Boolean).join(" ") ||
    "Propriétaire";
  const tenantName =
    [line.tenant_first_name, line.tenant_last_name].filter(Boolean).join(" ") || "Locataire";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-2.5">
          <RantiLogo size={28} />
          <span className="font-display text-lg font-extrabold tracking-tight text-foreground">Ranti</span>
          <span className="text-sm text-muted-foreground">· Compte loyer partagé</span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
          {line.label}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {TYPE_LABEL[line.type] ?? "Somme"} · ajoutée le {formatDate(line.occurred_at)}
        </p>

        <div className={`mt-6 rounded-2xl border px-5 py-4 text-sm ${banner.cls}`}>
          {banner.text}
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="mt-8 space-y-4 rounded-2xl border border-border bg-background p-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Propriétaire</span>
            <span className="font-medium text-foreground">{landlordName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Locataire</span>
            <span className="font-medium text-foreground">{tenantName}</span>
          </div>
          {line.unit_name && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Logement</span>
              <span className="text-foreground">{line.unit_name}</span>
            </div>
          )}
          {line.due_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">À régler avant</span>
              <span className="text-foreground">{formatDate(line.due_date)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span className="text-foreground/80">Montant</span>
            <span className="text-lg text-foreground">{formatFcfa(line.amount)}</span>
          </div>
        </div>

        {/* Version du locataire si contestation (deux voix, même retirée) */}
        {line.disputed_at && line.contest_nature && (
          <div className="mt-6 rounded-2xl border border-warning/50 bg-warning/10 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-warning">
              {NATURE_LABEL[line.contest_nature]}
            </p>
            <p className="mt-2 text-sm text-warning">
              {line.contest_nature === "amount" &&
                `Vous reconnaissez ${
                  line.contested_amount != null
                    ? formatFcfa(line.contested_amount)
                    : "un autre montant"
                }.`}
              {line.contest_nature === "not_owed" && "Vous déclarez ne pas devoir cette somme."}
              {line.contest_nature === "already_paid" && "Vous déclarez l'avoir déjà réglée."}
              {line.contest_nature === "other" && "Vous avez signalé un désaccord."}
              {line.tenant_comment ? ` « ${line.tenant_comment} »` : ""}
            </p>
          </div>
        )}

        {/* Actions */}
        {line.status === "pending" && (
          <div className="mt-8 space-y-3">
            <form action={validateCharge.bind(null, token)}>
              <SubmitButton
                className="inline-flex w-full justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60"
                pendingLabel="Envoi…"
              >
                Valider cette somme
              </SubmitButton>
            </form>
            <ContestForm token={token} />
          </div>
        )}

        {line.status === "disputed" && (
          <div className="mt-8">
            <form action={retractContest.bind(null, token)}>
              <SubmitButton
                className="inline-flex w-full justify-center rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary disabled:opacity-60"
                pendingLabel="Envoi…"
              >
                Retirer ma contestation et valider
              </SubmitButton>
            </form>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Une somme validée est définitive : toute correction passe par une
          ligne inverse, visible des deux parties. Ranti documente qui doit
          quoi, il ne tranche pas les litiges.
        </p>
      </div>
    </main>
  );
}
