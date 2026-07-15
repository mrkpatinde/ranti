import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { RantiLogo } from "@/components/ranti-logo"

// Page de vérification de DÉMONSTRATION, liée depuis la landing.
// Entièrement statique : aucune base, aucun montant (comme la page publique
// réelle /verifier/[id]). Le segment statique « demo » a priorité sur la
// route dynamique [id], donc /verifier/demo n'atteint jamais la base.

export const metadata: Metadata = {
  title: "Vérification de document (démonstration) — Ranti",
  robots: { index: false, follow: false },
}

// Numéro volontairement impossible (segment DEMO) : aucun vrai document ne
// doit pouvoir renvoyer vers cette page pour « emprunter » son verdict.
const rows: Array<[string, string]> = [
  ["Type", "Quittance de loyer"],
  ["Numéro", "RNT-2026-DEMO"],
  ["Émis le", "06 juillet 2026"],
  ["Locataire", "Adjovi H."],
  ["Bien", "Villa 3 ch — Fidjrossè"],
  ["Période réglée", "01 juillet 2026 → 31 juillet 2026"],
]

export default function VerifyDemoPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-4 flex items-center justify-center">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground/70 ring-1 ring-primary/15">
          Exemple de démonstration
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-7 shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)]">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <RantiLogo size={34} />
            <div>
              <p className="font-display font-extrabold tracking-tight">Ranti</p>
              <h1 className="text-xs font-normal text-muted-foreground">Vérification de document</h1>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground/70 ring-1 ring-primary/20">
            Exemple — sans valeur probante
          </span>
        </div>

        <dl className="space-y-4 py-5">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm font-semibold [font-variant-numeric:tabular-nums]">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="rounded-xl border border-primary/15 bg-secondary px-4 py-3 text-sm text-foreground/80">
          Ceci est un exemple de démonstration : aucun document réel ne porte ce numéro. Une vraie vérification affiche cet écran avec la mention «&nbsp;Document authentique&nbsp;» quand le document a bien été émis par Ranti et n&apos;a pas été modifié.
        </p>

        <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Par confidentialité, les montants ne sont jamais affichés sur cette page publique. Seul le document remis par le propriétaire les mentionne.
        </p>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.8} />
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
