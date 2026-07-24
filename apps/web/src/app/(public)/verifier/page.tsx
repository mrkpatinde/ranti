import type { Metadata } from "next"
import Link from "next/link"
import { RantiLogo } from "@/components/ranti-logo"
import { createClient } from "@/lib/supabase/server"
import { receiptIntegrityVerdict } from "@/lib/receipts/integrity"
import { kindLabels, STATE_BADGE, formatVerifyDate, REF_PATTERN } from "./_shared"

// Recherche publique d'un document par sa RÉFÉRENCE (RNT-AAAA-NNNN), pour le
// propriétaire comme pour le locataire qui tient la quittance en main sans le
// QR ni le lien. Surface volontairement plus pauvre que /verifier/[id] (le
// numéro est énumérable, l'UUID du QR ne l'est pas) : la RPC
// verify_receipt_by_number ne renvoie ni nom, ni logement, ni montant. En cas
// d'homonymie inter-propriétaires (numéros séquentiels par propriétaire), la
// RPC ne détaille rien et la page renvoie vers le lien/QR du document.

export const metadata: Metadata = {
  title: "Vérifier une quittance — Ranti",
  description:
    "Vérifiez l'authenticité d'une quittance ou d'un reçu Ranti à partir de sa référence (RNT-…).",
  robots: { index: false, follow: false },
}

type VerifyByNumberRow = {
  match_count: number
  receipt_number: string | null
  kind: string | null
  status: string | null
  issued_at: string | null
  periods: Array<{ period_start: string; period_end: string }> | null
  tenant_ack: string | null
  stored_fingerprint: string | null
  computed_fingerprint: string | null
}

function SearchForm({ defaultValue }: { defaultValue?: string }) {
  return (
    <form method="GET" action="/verifier" className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="ref" className="sr-only">
        Référence du document
      </label>
      <input
        id="ref"
        name="ref"
        type="text"
        required
        defaultValue={defaultValue}
        placeholder="RNT-2026-0001"
        autoComplete="off"
        spellCheck={false}
        className="h-[52px] flex-1 rounded-full border border-border bg-card px-6 font-mono text-sm uppercase tracking-wide text-foreground placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        className="inline-flex h-[52px] items-center justify-center rounded-full bg-accent px-7 text-sm font-semibold text-accent-foreground transition hover:bg-olive-deep"
      >
        Vérifier
      </button>
    </form>
  )
}

export default async function VerifySearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const raw = typeof sp.ref === "string" ? sp.ref.trim().toUpperCase() : null

  let result: VerifyByNumberRow | null | "invalid" | "error" = null
  if (raw) {
    if (!REF_PATTERN.test(raw)) {
      result = "invalid"
    } else {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("verify_receipt_by_number", {
        p_number: raw,
      })
      result = error ? "error" : ((data as VerifyByNumberRow[] | null)?.[0] ?? null)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center gap-3">
        <RantiLogo size={34} />
        <div>
          <p className="font-display font-extrabold tracking-tight">Ranti</p>
          <p className="text-xs text-muted-foreground">Vérification de document</p>
        </div>
      </div>

      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold tracking-[-0.02em] text-ink-title [text-wrap:balance]">
        Vérifier une quittance
      </h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
        Saisissez la référence imprimée sur le document (en haut à droite, sous la
        forme RNT-année-numéro). Le QR imprimé sur le PDF mène au même verdict.
      </p>

      <div className="mt-7">
        <SearchForm defaultValue={raw ?? undefined} />
      </div>

      {result === "invalid" && (
        <p className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
          Ce n&apos;est pas une référence Ranti : elle a la forme RNT-2026-0001.
        </p>
      )}

      {result === "error" && (
        <p className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
          Le service de vérification est momentanément indisponible. Réessayez plus tard.
        </p>
      )}

      {raw && result === null && (
        <p className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
          Aucun document ne porte la référence <span className="font-mono">{raw}</span>.
          Vérifiez la saisie, ou utilisez le lien ou le QR du document.
        </p>
      )}

      {result !== null && typeof result === "object" && result.match_count > 1 && (
        <p className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
          Plusieurs documents portent cette référence (les numéros sont propres à
          chaque propriétaire). Par confidentialité, utilisez le lien ou le QR
          imprimé sur votre document pour obtenir le verdict.
        </p>
      )}

      {result !== null &&
        typeof result === "object" &&
        result.match_count === 1 &&
        result.receipt_number && (
          <VerdictCard row={result} />
        )}

      <p className="mt-8 text-xs leading-5 text-muted-foreground">
        Par confidentialité, cette recherche par référence n&apos;affiche ni nom, ni
        logement, ni montant : uniquement l&apos;authenticité du document. Le détail
        complet reste sur le document lui-même et son lien partagé.{" "}
        <Link href="/verifier/demo" className="underline underline-offset-2 transition hover:text-foreground">
          Voir un exemple
        </Link>
        .
      </p>
    </main>
  )
}

function VerdictCard({ row }: { row: VerifyByNumberRow }) {
  const state = receiptIntegrityVerdict({
    status: row.status ?? "issued",
    storedFingerprint: row.stored_fingerprint,
    computedFingerprint: row.computed_fingerprint,
  })
  const badge = STATE_BADGE[state]
  const showFingerprint =
    row.stored_fingerprint && (state === "verified" || state === "tampered")

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)]">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="font-display font-extrabold tracking-tight">
          {kindLabels[row.kind ?? ""] ?? "Document"}
        </p>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <dl className="space-y-4 py-4">
        <div>
          <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Numéro</dt>
          <dd className="mt-1 text-sm font-semibold [font-variant-numeric:tabular-nums]">{row.receipt_number}</dd>
        </div>
        {row.issued_at ? (
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Émis le</dt>
            <dd className="mt-1 text-sm font-semibold">{formatVerifyDate(row.issued_at)}</dd>
          </div>
        ) : null}
        {row.periods && row.periods.length > 0 ? (
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Période réglée</dt>
            <dd className="mt-1 text-sm font-semibold">
              {row.periods.map((p) => `${formatVerifyDate(p.period_start)} → ${formatVerifyDate(p.period_end)}`).join(" · ")}
            </dd>
          </div>
        ) : null}
      </dl>

      {state === "verified" ? (
        <p className="rounded-xl border border-primary/15 bg-secondary px-4 py-3 text-sm text-foreground/80">
          Empreinte recalculée identique à celle scellée à la certification : ce
          document n&apos;a pas été modifié depuis. Il correspond au PDF portant le
          même numéro.
        </p>
      ) : state === "unsealed" ? (
        <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
          Ce document a bien été émis par Ranti. Il n&apos;a pas encore été certifié
          par le locataire : aucune empreinte d&apos;intégrité n&apos;y est scellée.
        </p>
      ) : state === "tampered" ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          L&apos;empreinte recalculée ne correspond pas à celle scellée à la
          certification. Ce document a été modifié depuis : il ne vaut pas preuve
          de paiement.
        </p>
      ) : (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Ce document a été annulé par son émetteur. Il ne vaut plus preuve de paiement.
        </p>
      )}

      {showFingerprint ? (
        <p className="mt-4 break-all text-xs leading-5 text-muted-foreground">
          Empreinte SHA-256 scellée :{" "}
          <span className="font-mono text-[0.72rem] text-foreground">{row.stored_fingerprint}</span>
        </p>
      ) : null}
    </div>
  )
}
