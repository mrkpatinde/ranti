/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { AUTH_PATHS, signInWithGoogle } from "@/lib/auth";
import { RantiWordmark } from "@/components/ranti-wordmark";
import { Badge } from "@/components/ui/badge";
import { formatFcfa, formatFcfaNumber } from "@/lib/format";

// Landing marketing — portage de « Landing.html » (Ranti Design System,
// projet claude.ai/design). Couleurs et espacements mappés sur les tokens
// sémantiques prod (globals.css @theme), jamais de hex en dur (bezel du
// téléphone excepté : chrome d'appareil volontairement sombre dans les deux
// thèmes). Composant serveur : le CTA appelle l'action `signInWithGoogle`,
// la FAQ est en <details> natif, les animations sont pures CSS.

// Glyphe Google officiel — seule exception hex tolérée (marque tierce, OAuth).
function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center" aria-label="Ranti — accueil">
          <RantiWordmark size={30} />
        </Link>
        <div className="flex items-center gap-2.5">
          <Link
            href={AUTH_PATHS.signIn}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            Se connecter
          </Link>
          <Link
            href={AUTH_PATHS.signUp}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-olive-deep"
          >
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-6 py-[clamp(72px,13vw,150px)]">
      <div className="lp-rise mx-auto max-w-3xl text-center">
        <h1 className="font-display text-[clamp(2.6rem,6.6vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink-title [text-wrap:balance]">
          Le registre de loyer des propriétaires africains.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[clamp(1.1rem,1.8vw,1.3rem)] leading-relaxed text-muted-foreground">
          Vous encaissez le loyer, Ranti édite la quittance. Il tient votre registre et relance vos
          locataires à votre place. Vous validez, c'est tout.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-foreground shadow-[0_10px_28px_-12px_hsl(var(--accent)/0.6)] transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-olive-deep hover:shadow-[0_18px_38px_-14px_hsl(var(--accent)/0.7)] motion-reduce:hover:translate-y-0"
            >
              <GoogleGlyph />
              Commencer avec Google
            </button>
          </form>
        </div>
        {/* Tarif ADR-024 : abonnement par paliers, gratuit pour un logement
            (DESIGN.md et CGU réalignés — le « 5 % » est abandonné). */}
        <p className="mt-[18px] flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Gratuit pour un logement</span>
          <span aria-hidden="true" className="opacity-40">·</span>
          <span>Ranti ne touche jamais l'argent</span>
        </p>
      </div>
    </section>
  );
}

// Colonne d'une tuile de stat du registre (mockup).
function StatCol({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-2 py-3.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`font-display text-[15px] font-extrabold tracking-tight tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

// Ligne « à encaisser » du registre (mockup).
function DueRow({
  name,
  meta,
  badge,
}: {
  name: string;
  meta: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-t border-line-soft py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{name}</div>
        <div className="text-xs tabular-nums text-muted-foreground">{meta}</div>
      </div>
      {badge}
    </div>
  );
}

// Maquette du registre sur téléphone — visuel décoratif (données d'exemple),
// masqué aux lecteurs d'écran.
function PhoneRegister() {
  return (
    <div
      aria-hidden="true"
      // Bezel d'appareil : sombre volontairement dans les deux thèmes (chrome
      // physique, pas une surface de contenu) — d'où l'unique valeur en dur.
      className="mx-auto w-[300px] rounded-[42px] bg-[#211f1c] p-[11px] shadow-[0_40px_80px_-30px_rgba(41,41,41,0.5)]"
    >
      <div className="flex flex-col overflow-hidden rounded-[32px] bg-background">
        <div className="px-5 pb-1.5 pt-[22px]">
          <h3 className="font-display text-[26px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink-title">
            Bonjour Florentine
          </h3>
          <p className="mt-1.5 text-[13px] text-muted-foreground">juillet 2026</p>
        </div>
        <div className="px-5 py-3.5">
          <div className="flex overflow-hidden rounded-lg border border-border bg-card">
            <StatCol label="Payé" value={formatFcfaNumber(600000)} tone="text-olive-deep" />
            <div className="w-px bg-border" />
            <StatCol label="Attendu" value={formatFcfaNumber(900000)} tone="text-ink-title" />
            <div className="w-px bg-border" />
            <StatCol label="Retard" value={formatFcfaNumber(300000)} tone="text-warning" />
          </div>
        </div>
        <div className="px-5 pb-2">
          <h4 className="mb-0.5 mt-1.5 text-[13px] font-semibold text-muted-foreground">À encaisser</h4>
          <DueRow
            name="Kofi Mensah"
            meta={`${formatFcfa(100000)} · Studio`}
            badge={
              // Wash retard exact de la DA (#ffe7e2) — le Badge « warning »
              // partagé pose bg-warning/10, teinte différente ; badge sur-mesure
              // pour ce mockup décoratif.
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning-wash px-3 py-1 text-xs font-medium text-warning">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                En retard
              </span>
            }
          />
          <DueRow
            name="Awa Diop"
            meta={`${formatFcfa(100000)} · Appart. 2 ch`}
            badge={<Badge variant="neutral">Relance envoyée</Badge>}
          />
          <div className="border-t border-line-soft py-3 text-[13px] text-muted-foreground">
            + 6 locataires à jour
          </div>
        </div>
        <div className="border-t border-line-soft bg-surface-2 p-4">
          <div className="w-full rounded-full bg-accent px-5 py-3 text-center text-sm font-semibold text-accent-foreground">
            Confirmer un paiement
          </div>
        </div>
      </div>
    </div>
  );
}

// Une étape de « Comment ça marche ».
function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground">
          {n}
        </span>
        <span className="h-0.5 w-[34px] bg-leaf" />
      </div>
      <h3 className="font-display text-[1.35rem] font-bold tracking-[-0.01em] text-ink-title">{title}</h3>
      <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Steps() {
  return (
    <section
      id="how"
      className="border-y border-line-soft bg-muted px-6 py-[clamp(48px,7vw,88px)]"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-[clamp(36px,6vw,80px)] md:grid-cols-[1fr_.82fr]">
        <div>
          <h2 className="mb-2 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-ink-title">
            Comment ça marche
          </h2>
          <p className="mb-9 text-[1.05rem] text-muted-foreground">Trois gestes. Le registre fait le reste.</p>
          <div className="flex flex-col gap-7">
            <Step
              n="1"
              title="Vous renseignez le bail"
              body="Locataire, logement, montant, échéance. Ranti crée les échéances du mois, automatiquement."
            />
            <Step
              n="2"
              title="Ranti relance à votre place"
              body="Un message neutre, signé du registre, part avant l'échéance. Plus besoin de choisir entre votre argent et votre gentillesse."
            />
            <Step
              n="3"
              title="La quittance s'édite, signée"
              body="Vous validez le paiement reçu. Ranti édite la quittance, confirmée par le locataire et infalsifiable."
            />
          </div>
        </div>
        <div className="lp-rise">
          <PhoneRegister />
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS: [string, string][] = [
  [
    "Est-ce que Ranti prend une commission sur mes loyers ?",
    "Non. Ranti ne touche pas vos loyers et ne prend aucune commission. Vous payez un abonnement simple, gratuit pour un seul logement.",
  ],
  [
    "Où va l'argent du loyer ?",
    "Directement du locataire à vous : cash, Mobile Money ou virement. Ranti garde la preuve du paiement, jamais les fonds.",
  ],
  [
    "Mes locataires doivent-ils créer un compte ?",
    "Non. Ils reçoivent la relance et la quittance par un simple lien, et confirment la réception en un geste, sans compte.",
  ],
  [
    "Comment marchent les relances ?",
    "À partir du bail, Ranti prépare une relance neutre, signée « du registre ». Elle part avant l'échéance, sans que vous ayez à écrire quoi que ce soit.",
  ],
  [
    "Je gère un bien depuis l'étranger, est-ce que ça marche ?",
    "Oui. Ranti est pensé d'abord pour les propriétaires à distance : vous voyez enfin qui a payé, sans dépendre d'un proche ou d'un gérant sur place.",
  ],
];

function Faq() {
  return (
    <section id="faq" className="border-t border-line-soft px-6 py-[clamp(40px,6vw,72px)]">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-7 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-ink-title">
          Questions fréquentes
        </h2>
        <div>
          {FAQ_ITEMS.map(([q, a]) => (
            <details key={q} className="group border-t border-border py-[18px] [&>summary]:list-none">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-[1.15rem] font-semibold text-ink-title [&::-webkit-details-marker]:hidden">
                {q}
                <span className="shrink-0 text-[22px] leading-none text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[660px] text-base leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
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
          <Link href="/conditions" className="transition hover:text-foreground">
            Conditions d'utilisation
          </Link>
          <Link href="/confidentialite" className="transition hover:text-foreground">
            Confidentialité
          </Link>
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
        <Steps />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
