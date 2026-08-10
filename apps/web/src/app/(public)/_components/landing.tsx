/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { AUTH_PATHS } from "@/lib/auth";
import { RantiWordmark } from "@/components/ranti-wordmark";
import { formatFcfa, formatFcfaNumber } from "@/lib/format";

// Landing marketing — pivot ADR-029 : le client est l'entreprise de gestion
// immobilière (agence, administrateur de biens) et le produit vendu est la
// clôture mensuelle du portefeuille. Couleurs et espacements mappés sur les
// tokens sémantiques prod (globals.css @theme), jamais de hex en dur.
// Composant serveur : le CTA unique mène à /signup (inscription Google),
// l'aperçu du relevé propriétaire est construit en HTML/CSS et reprend la
// structure du PDF réel (lib/statements/pdf.tsx) — mêmes règles de calcul
// (honoraires floor ligne par ligne, totaux = somme des lignes), de sorte que
// les chiffres affichés s'additionnent exactement.

// Pill CTA principal — même style que l'ancien bouton hero (handoff §8),
// partagé entre le hero et la reprise de fin de page.
const CTA_PILL =
  "inline-flex items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-foreground shadow-[0_10px_28px_-12px_hsl(var(--accent)/0.6)] transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-olive-deep hover:shadow-[0_18px_38px_-14px_hsl(var(--accent)/0.7)] motion-reduce:hover:translate-y-0";

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center" aria-label="Ranti — accueil">
          <RantiWordmark size={30} />
        </Link>
        {/* Une seule entrée au header (décision 2026-07-18) : le CTA du hero
            vers /signup reste l'unique appel à l'action. */}
        <Link
          href={AUTH_PATHS.signIn}
          className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-6 py-[clamp(72px,13vw,150px)]">
      <div className="lp-rise mx-auto max-w-3xl text-center">
        <h1 className="font-display text-[clamp(2.6rem,6.6vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink-title [text-wrap:balance]">
          La clôture de votre mois, en une heure.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[clamp(1.1rem,1.8vw,1.3rem)] leading-relaxed text-muted-foreground">
          Ranti suit les encaissements de votre portefeuille, relance les retards par lot et
          établit pour chaque propriétaire mandant le relevé du mois : encaissé, honoraires,
          net à reverser. Les loyers restent sur le compte de votre agence.
        </p>
        <div className="mt-9 flex justify-center">
          <Link href={AUTH_PATHS.signUp} className={CTA_PILL}>
            Créer l'espace de votre agence
          </Link>
        </div>
        <p className="mt-[18px] flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Inscription avec Google</span>
          <span aria-hidden="true" className="opacity-40">·</span>
          <span>Portefeuille importé par fichier Excel ou CSV</span>
        </p>
      </div>
    </section>
  );
}

// Le mois de l'agence, en quatre gestes — une ligne chacun.
const FLOW_STEPS = [
  "Importez votre portefeuille : fichier Excel, CSV ou collage.",
  "Suivez les encaissements, lot par lot, au fil du mois.",
  "Relancez les retards par lot, depuis le WhatsApp de l'agence.",
  "Clôturez le mois : un relevé PDF par mandant, prêt à envoyer.",
];

function Flow() {
  return (
    <section className="border-y border-line-soft bg-muted px-6 py-[clamp(48px,7vw,88px)]">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-ink-title">
          Le mois, en quatre temps
        </h2>
        <ol className="flex flex-col gap-5">
          {FLOW_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-4">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground">
                {i + 1}
              </span>
              <p className="pt-[3px] text-[1.05rem] leading-relaxed text-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Spécimen du relevé propriétaire — données d'exemple, loyers courants à
// Cotonou. Les honoraires sont calculés comme dans le produit
// (floor(encaissé × taux) ligne par ligne, migration 20260809120700) et les
// totaux sont la somme des lignes : le document se vérifie de tête.
const STATEMENT_FEE_RATE_BP = 800; // 8 %

const STATEMENT_LINES = [
  { lot: "Villa Fidjrossè · Apt A", tenant: "J. Hounkpatin", collected: 120_000 },
  { lot: "Villa Fidjrossè · Apt B", tenant: "F. Akplogan", collected: 90_000 },
  { lot: "Imm. Gbégamey · 2e étage", tenant: "M. Tossou", collected: 75_000 },
  { lot: "Imm. Gbégamey · 1er étage", tenant: "D. Vodounon", collected: 60_000 },
  { lot: "Studio Zogbo", tenant: "S. Gnonlonfoun", collected: 40_000 },
];

function StatementCard() {
  const rows = STATEMENT_LINES.map((line) => {
    const fee = Math.floor((line.collected * STATEMENT_FEE_RATE_BP) / 10_000);
    return { ...line, fee, net: line.collected - fee };
  });
  const totals = rows.reduce(
    (acc, r) => ({
      collected: acc.collected + r.collected,
      fee: acc.fee + r.fee,
      net: acc.net + r.net,
    }),
    { collected: 0, fee: 0, net: 0 },
  );

  return (
    <div className="lp-rise rounded-[18px] border border-border bg-card p-5 shadow-[0_30px_60px_-35px_rgba(41,41,41,0.45)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line-soft pb-4">
        <div>
          <p className="font-display text-lg font-bold tracking-[-0.01em] text-ink-title">
            Immobilière du Littoral
          </p>
          <p className="text-xs text-muted-foreground">Cadjèhoun, Cotonou</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">Relevé de gestion</p>
          <p className="text-xs text-muted-foreground">juillet 2026</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Propriétaire mandant</p>
          <p className="text-sm font-semibold text-foreground">Rosine Ahouansou</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Honoraires de gestion</p>
          <p className="text-sm font-semibold text-foreground">8 % des sommes encaissées</p>
          <p className="text-xs text-muted-foreground">Montants en FCFA (XOF)</p>
        </div>
      </div>
      <table className="w-full [font-variant-numeric:tabular-nums]">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-2 text-left font-medium">Bien · lot</th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">Encaissé</th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">Honoraires</th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="text-[13px]">
          {rows.map((r) => (
            <tr key={r.lot} className="border-b border-line-soft">
              <td className="py-2.5 pr-2">
                <span className="block font-medium text-foreground">{r.lot}</span>
                <span className="block text-xs text-muted-foreground">{r.tenant}</span>
              </td>
              <td className="py-2.5 pl-2 text-right align-top text-foreground">
                {formatFcfaNumber(r.collected)}
              </td>
              <td className="py-2.5 pl-2 text-right align-top text-muted-foreground">
                {formatFcfaNumber(r.fee)}
              </td>
              <td className="py-2.5 pl-2 text-right align-top font-semibold text-foreground">
                {formatFcfaNumber(r.net)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-sm text-foreground">
            <td className="py-3 pr-2">
              <span className="font-semibold">Total</span>{" "}
              <span className="text-xs text-muted-foreground">{rows.length} lots</span>
            </td>
            <td className="py-3 pl-2 text-right font-semibold">
              {formatFcfaNumber(totals.collected)}
            </td>
            <td className="py-3 pl-2 text-right font-semibold">{formatFcfaNumber(totals.fee)}</td>
            <td className="py-3 pl-2 text-right font-semibold">{formatFcfaNumber(totals.net)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-secondary px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Net à reverser au propriétaire</p>
        <p className="font-display text-xl font-extrabold tracking-tight text-olive-deep [font-variant-numeric:tabular-nums]">
          {formatFcfa(totals.net)}
        </p>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Honoraires : 8 % de l'encaissé, calculés lot par lot. Net = encaissé moins honoraires.
        Le total est la somme des lignes.
      </p>
    </div>
  );
}

function Statement() {
  return (
    <section className="px-6 py-[clamp(48px,7vw,88px)]">
      <div className="mx-auto grid max-w-6xl items-center gap-[clamp(36px,6vw,72px)] md:grid-cols-[.85fr_1fr]">
        <div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-ink-title">
            Le relevé propriétaire
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">
            À la clôture, chaque mandant reçoit le décompte de ses lots : encaissé, honoraires
            retenus, net reversé. Les totaux sont la somme des lignes ; un mandant qui recompte
            tombe sur le même chiffre.
          </p>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">
            Le mandant ne crée aucun compte. Il reçoit ce document en PDF, à l'en-tête de votre
            agence.
          </p>
        </div>
        <StatementCard />
      </div>
    </section>
  );
}

function Money() {
  return (
    <section className="border-t border-line-soft bg-muted px-6 py-[clamp(48px,7vw,88px)]">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-ink-title">
          Les loyers ne passent jamais par Ranti
        </h2>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">
          Le locataire paie comme aujourd'hui : Mobile Money sur le numéro marchand de l'agence,
          virement ou espèces. Ranti enregistre l'encaissement, relance, atteste et produit le
          relevé. Il ne reçoit, ne détient et ne transfère jamais les fonds ; cet engagement est
          inscrit à l'article 3 des{" "}
          <Link
            href="/conditions"
            className="text-foreground underline underline-offset-4 transition hover:text-accent"
          >
            conditions d'utilisation
          </Link>
          .
        </p>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">
          Aucun intermédiaire ne s'ajoute entre le locataire et votre compte : pas de délai de
          reversement, pas de commission sur les encaissements.
        </p>
        {/* ADR-028 (gratuit pour le moment) : aucun prix affiché tant que
            l'utilité n'est pas démontrée — seulement l'engagement de préavis. */}
        <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">
          Et Ranti est gratuit aujourd'hui, sans limite de lots. Si un tarif arrive un jour,
          votre agence sera prévenue avant : pas de carte enregistrée, rien à résilier.
        </p>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="border-t border-line-soft px-6 py-[clamp(48px,7vw,88px)]">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-display text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold tracking-[-0.01em] text-ink-title [text-wrap:balance]">
          Votre prochaine clôture peut se faire dans Ranti.
        </p>
        <div className="mt-7 flex justify-center">
          <Link href={AUTH_PATHS.signUp} className={CTA_PILL}>
            Créer l'espace de votre agence
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line-soft bg-muted">
      <div className="mx-auto max-w-6xl px-6 py-[clamp(40px,6vw,64px)]">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href="/a-propos" className="transition hover:text-foreground">
            À propos
          </Link>
          <Link href="/conditions" className="transition hover:text-foreground">
            Conditions d'utilisation
          </Link>
          <Link href="/confidentialite" className="transition hover:text-foreground">
            Confidentialité
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>WI'SOFT SOLUTIONS</span>
          <span aria-hidden="true">·</span>
          <span>RCCM RB/COT/20 A 62590</span>
          <span aria-hidden="true">·</span>
          <span>IFU 0202377982188</span>
          <span aria-hidden="true">·</span>
          <a href="mailto:mrkpatinde@gmail.com" className="transition hover:text-foreground">
            mrkpatinde@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="lp-bg" aria-hidden="true">
        <span className="lp-dots" />
        <span className="lp-blob lp-blob-1" />
        <span className="lp-blob lp-blob-2" />
        <span className="lp-blob lp-blob-3" />
      </div>
      <Header />
      <main className="flex-1">
        <Hero />
        <Flow />
        <Statement />
        <Money />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
