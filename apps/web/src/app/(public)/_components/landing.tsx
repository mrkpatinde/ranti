/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { AUTH_PATHS, signInWithGoogle } from "@/lib/auth";
import { RantiWordmark } from "@/components/ranti-wordmark";
import { Badge } from "@/components/ui/badge";
import { formatFcfa, formatFcfaNumber } from "@/lib/format";

// Landing marketing : structure empruntée à moneco.app (référence CEO
// 2026-07-24 : héro centré + mockup téléphone sur colline pastel, section
// sombre encre à cards, tarifs en cards, FAQ en pilules arrondies, footer
// multi-colonnes), identité Ranti intacte : Fraunces/Hanken, palette DA via
// tokens sémantiques (globals.css @theme), wording existant, voix « vous ».
// Jamais de hex en dur (bezel du téléphone excepté : chrome d'appareil
// volontairement sombre). Composant serveur : le CTA appelle l'action
// `signInWithGoogle`, la FAQ est en <details> natif, animations pures CSS.

// Glyphe Google officiel : seule exception hex tolérée (marque tierce, OAuth).
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

// Bouton CTA principal (pilule olive) : partagé héro + section tarifs.
function CtaGoogle() {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-foreground shadow-[0_10px_28px_-12px_hsl(var(--accent)/0.6)] transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-olive-deep hover:shadow-[0_18px_38px_-14px_hsl(var(--accent)/0.7)] motion-reduce:hover:translate-y-0"
      >
        <GoogleGlyph />
        Commencer avec Google
      </button>
    </form>
  );
}

function PricingLine({ className = "" }: { className?: string }) {
  // Tarif ADR-024 : abonnement par paliers, gratuit pour un logement
  // (DESIGN.md et CGU réalignés, le « 5 % » est abandonné).
  // Pas de taille de texte ici : Tailwind tranche les conflits par ordre de
  // feuille générée, pas par ordre de className ; chaque appelant passe la
  // sienne (text-sm au héro, text-base aux tarifs).
  return (
    <p className={`flex flex-wrap items-center justify-center gap-2 text-muted-foreground ${className}`}>
      <span>Gratuit pour un logement</span>
      <span aria-hidden="true" className="opacity-40">·</span>
      <span>Ranti ne touche jamais l'argent</span>
    </p>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center" aria-label="Ranti — accueil">
          <RantiWordmark size={30} />
        </Link>
        {/* Nav centrale façon Moneco : ancres internes uniquement. */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#how" className="transition hover:text-foreground">
            Comment ça marche
          </a>
          <a href="#tarifs" className="transition hover:text-foreground">
            Tarifs
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            Questions fréquentes
          </a>
        </nav>
        {/* Une seule entrée au header (décision 2026-07-18) : le grand CTA
            « Commencer avec Google » du héro reste l'unique appel à l'action. */}
        <Link
          href={AUTH_PATHS.signIn}
          className="rounded-full border border-line-soft bg-card px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden px-6 pt-[clamp(64px,10vw,120px)]">
      <div className="lp-rise mx-auto max-w-3xl text-center">
        <h1 className="font-display text-[clamp(2.6rem,6.6vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink-title [text-wrap:balance]">
          Le registre de loyer des propriétaires africains.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[clamp(1.1rem,1.8vw,1.3rem)] leading-relaxed text-muted-foreground">
          Vous encaissez le loyer, Ranti édite la quittance. Il tient votre registre et relance vos
          locataires à votre place. Vous validez, c'est tout.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <CtaGoogle />
        </div>
        <PricingLine className="mt-[18px] text-sm" />
      </div>
      {/* Mockup téléphone posé sur une « colline » pastel, façon Moneco :
          ellipse en teinte verte douce, téléphone à cheval sur l'horizon. */}
      <div className="relative mx-auto mt-[clamp(40px,6vw,72px)] max-w-6xl">
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 h-[52%] w-[min(1400px,160vw)] -translate-x-1/2 rounded-t-[100%] bg-secondary"
        />
        <div className="lp-rise-2 relative pb-1">
          <PhoneRegister />
        </div>
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

// Maquette du registre sur téléphone : visuel décoratif (données d'exemple),
// masqué aux lecteurs d'écran.
function PhoneRegister() {
  return (
    <div
      aria-hidden="true"
      // Bezel d'appareil : sombre volontairement (chrome physique, pas une
      // surface de contenu), d'où l'unique valeur en dur.
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
              // Wash retard exact de la DA (#ffe7e2) : le Badge « warning »
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

// Card d'étape de « Comment ça marche » : sur fond encre, façon Moneco
// (cards arrondies sur section sombre), couleurs 100 % tokens DA : crème
// en voile pour la surface, feuille pour la pastille de numéro.
function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-background/10 bg-background/[0.06] p-7">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-leaf font-display text-base font-bold text-ink-title">
        {n}
      </span>
      <h3 className="font-display text-[1.35rem] font-bold tracking-[-0.01em] text-background">{title}</h3>
      <p className="text-base leading-relaxed text-background/70">{body}</p>
    </div>
  );
}

function Steps() {
  return (
    <section id="how" className="scroll-mt-[72px] bg-ink-title px-6 py-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(2.1rem,4.5vw,2.9rem)] font-extrabold tracking-[-0.02em] text-background [text-wrap:balance]">
            Comment ça marche
          </h2>
          <span aria-hidden="true" className="mx-auto mt-4 block h-1 w-16 rounded-full bg-leaf" />
          <p className="mt-5 text-[1.05rem] text-background/70">Trois gestes. Le registre fait le reste.</p>
        </div>
        <div className="mt-[clamp(36px,5vw,56px)] grid gap-5 md:grid-cols-3">
          <StepCard
            n="1"
            title="Vous renseignez le bail"
            body="Locataire, logement, montant, échéance. Ranti crée les échéances du mois, automatiquement."
          />
          <StepCard
            n="2"
            title="Ranti relance à votre place"
            body="Un message neutre, signé du registre, part avant l'échéance. Plus besoin de choisir entre votre argent et votre gentillesse."
          />
          <StepCard
            n="3"
            title="La quittance s'édite, signée"
            body="Vous validez le paiement reçu. Ranti édite la quittance, confirmée par le locataire et infalsifiable."
          />
        </div>
      </div>
    </section>
  );
}

// Grille B-1 (ADR-024, Master Blueprint 12/07/2026) : Découverte gratuit à vie
// pour un logement, Starter 4 900 F/mois (1 à 5), Pro 14 900 F/mois (6 à 20),
// annuel = 2 mois offerts. Aucun autre chiffre : rien d'inventé.
const TIERS: Array<{
  name: string;
  price: string;
  cadence: string | null;
  scope: string;
  detail: string;
  featured: boolean;
}> = [
  {
    name: "Découverte",
    price: "0 F",
    cadence: null,
    scope: "1 logement",
    detail: "Gratuit à vie. Tout le registre : échéances, relances, quittances.",
    featured: false,
  },
  {
    name: "Starter",
    price: formatFcfaNumber(4900),
    cadence: "F / mois",
    scope: "1 à 5 logements",
    detail: "Le même registre, pour tout votre portefeuille de départ.",
    featured: true,
  },
  {
    name: "Pro",
    price: formatFcfaNumber(14900),
    cadence: "F / mois",
    scope: "6 à 20 logements",
    detail: "Pour les propriétaires établis, plusieurs biens et immeubles.",
    featured: false,
  },
];

function TierCard({ tier }: { tier: (typeof TIERS)[number] }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-[24px] border bg-card p-7 ${
        tier.featured ? "border-accent shadow-[0_18px_44px_-20px_hsl(var(--accent)/0.45)]" : "border-line-soft"
      }`}
    >
      <span className="text-sm font-semibold text-muted-foreground">{tier.name}</span>
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-[2.1rem] font-extrabold tracking-tight tabular-nums text-ink-title">
          {tier.price}
        </span>
        {tier.cadence ? <span className="text-sm text-muted-foreground">{tier.cadence}</span> : null}
      </p>
      <p className="text-sm font-semibold text-foreground">{tier.scope}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{tier.detail}</p>
    </div>
  );
}

function Pricing() {
  return (
    <section id="tarifs" className="scroll-mt-[72px] border-t border-line-soft bg-secondary px-6 py-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(2.1rem,4.5vw,2.9rem)] font-extrabold tracking-[-0.02em] text-ink-title">
            Tarifs
          </h2>
          <PricingLine className="mt-4 text-base" />
        </div>
        <div className="mx-auto mt-[clamp(32px,4.5vw,48px)] grid max-w-4xl gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Abonnement annuel : 2 mois offerts.
        </p>
        <div className="mt-8 flex justify-center">
          <CtaGoogle />
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
    <section id="faq" className="scroll-mt-[72px] px-6 py-[clamp(56px,8vw,96px)]">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center font-display text-[clamp(2.1rem,4.5vw,2.9rem)] font-extrabold tracking-[-0.02em] text-ink-title">
          Questions fréquentes
        </h2>
        {/* Items en pilules arrondies façon Moneco : cards fermées, la
            question porte seule ; <details> natif conservé. */}
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map(([q, a]) => (
            <details
              key={q}
              className="group rounded-2xl border border-line-soft bg-card px-6 py-[18px] [&>summary]:list-none"
            >
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

// Lien de colonne du footer : interne (Link) ou externe/ancre (a) selon href.
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "text-sm text-muted-foreground transition hover:text-foreground";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}

// Entrée de footer annoncée mais pas encore ouverte : pas de lien mort,
// un libellé neutre + pastille « Bientôt ».
function FooterSoon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground/70">
      {label}
      <Badge variant="neutral">Bientôt</Badge>
    </span>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-title">{title}</h3>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

// Footer multi-colonnes façon Moneco. Chaque lien pointe vers une destination
// réelle ; Blog et Carrières sont annoncés « Bientôt » sans lien tant que les
// pages n'existent pas. La raison sociale (WI'SOFT, RCCM, IFU) vit sur
// /a-propos et dans les CGU, pas ici (décision CEO 2026-07-24).
function SiteFooter() {
  return (
    <footer className="border-t border-line-soft bg-muted">
      <div className="mx-auto max-w-6xl px-6 pb-10 pt-[clamp(40px,6vw,64px)]">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <RantiWordmark size={26} />
            <p className="mt-4 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
              Le registre de loyer des propriétaires africains. Ranti ne touche
              jamais l'argent.
            </p>
          </div>
          <FooterCol title="Produit">
            <li><FooterLink href="#how">Comment ça marche</FooterLink></li>
            <li><FooterLink href="#tarifs">Tarifs</FooterLink></li>
            <li><FooterLink href="/verifier">Vérifier une quittance</FooterLink></li>
            <li><FooterLink href={AUTH_PATHS.signIn}>Se connecter</FooterLink></li>
          </FooterCol>
          <FooterCol title="Ressources">
            <li><FooterLink href="#faq">Questions fréquentes</FooterLink></li>
            <li><FooterLink href="/conditions">Conditions d'utilisation</FooterLink></li>
            <li><FooterLink href="/confidentialite">Confidentialité</FooterLink></li>
            <li><FooterSoon label="Blog" /></li>
          </FooterCol>
          <FooterCol title="Entreprise">
            <li><FooterLink href="/a-propos">À propos</FooterLink></li>
            <li><FooterLink href="mailto:mrkpatinde@gmail.com">Contact</FooterLink></li>
            <li><FooterSoon label="Carrières" /></li>
          </FooterCol>
        </div>
        <div className="mt-12 border-t border-line-soft pt-6">
          <p className="text-xs text-muted-foreground">© 2026 Ranti. Tous droits réservés.</p>
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
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
