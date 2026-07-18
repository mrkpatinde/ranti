import { RantiLogo } from "@/components/ranti-logo"
import { SubmitButton } from "@/components/submit-button"
import { ERECEIPT_CONSENT_WORDING } from "@/lib/receipts/consent"
import { grantEreceiptConsent } from "./actions"

// Écran de consentement à la quittance électronique : intercepte le PREMIER
// accès du locataire à un lien /recu, avant tout affichage du document (qui
// n'est même pas marqué « lu » avant l'accord). Case obligatoire (required
// natif, aucun JS), une seule fois par locataire : l'accord vaut pour toutes
// les quittances suivantes. Copy sobre, sans tiret cadratin.
export function ConsentScreen({
  token,
  tenantFirstName,
  errorMsg,
}: {
  token: string
  tenantFirstName: string | null
  errorMsg: string | null
}) {
  const greeting = tenantFirstName ? `Bonjour ${tenantFirstName}` : "Bonjour"
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-stretch bg-background px-4 py-10 sm:py-14">
      <header className="mb-6 flex items-center justify-between gap-3">
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

      <h1 className="font-display text-[1.7rem] font-extrabold leading-tight tracking-tight text-foreground">
        {greeting}, avant d&apos;ouvrir votre quittance.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Votre propriétaire édite vos quittances de loyer au format électronique
        via Ranti. Pour vous les remettre en ligne, la loi demande votre accord
        explicite. Une seule fois : il vaudra pour toutes vos prochaines
        quittances.
      </p>

      {errorMsg ? (
        <div className="mt-4 rounded-[19px] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : null}

      <form
        action={grantEreceiptConsent.bind(null, token)}
        className="mt-6 overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_1px_2px_rgba(41,41,41,0.05),0_18px_40px_-18px_rgba(41,41,41,0.20)]"
      >
        <label className="flex cursor-pointer items-start gap-3 p-6 sm:p-7">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-border accent-[hsl(var(--accent))]"
          />
          <span className="text-sm leading-relaxed text-foreground">
            {ERECEIPT_CONSENT_WORDING}
          </span>
        </label>
        <div className="flex flex-col gap-3 border-t border-border bg-muted px-6 py-5 sm:px-7">
          <SubmitButton
            className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-accent-foreground shadow-[0_1px_2px_rgba(91,111,0,0.22),0_8px_20px_-8px_rgba(91,111,0,0.38)] transition hover:brightness-105 disabled:opacity-60"
            pendingLabel="Enregistrement…"
          >
            Continuer vers ma quittance
          </SubmitButton>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Votre accord est enregistré et horodaté dans le registre. Sans
            accord, votre propriétaire vous remet la quittance par un autre
            moyen.
          </p>
        </div>
      </form>
    </main>
  )
}
