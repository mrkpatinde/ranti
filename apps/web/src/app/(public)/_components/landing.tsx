/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import {
  ArrowRight,
  Check,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

const SIGNUP_HREF = "/signup";

import { RantiLogo } from "@/components/ranti-logo";

function StatusBadge({ tone, children }: { tone: "paid" | "late"; children: React.ReactNode }) {
  const tones = {
    paid: "bg-[#e5eacd] text-[#292929]",
    late: "bg-[#ffe7e2] text-[#bd4a30]",
  };
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Emplacement de la démo vidéo. Tant que DEMO_VIDEO_SRC est null, le hero
// montre la carte produit (page vivante). Déposer la vidéo dans
// apps/web/public/ (ex. demo.mp4) puis passer DEMO_VIDEO_SRC à "/demo.mp4".
const DEMO_VIDEO_SRC: string | null = null;

function HeroMedia() {
  if (!DEMO_VIDEO_SRC) return <ProductPreview />;
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#d5d5d2] bg-black shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)]">
      <video
        className="aspect-video w-full"
        controls
        playsInline
        preload="metadata"
        poster="/demo-poster.jpg"
      >
        <source src={DEMO_VIDEO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}

// La carte du mois — l'écran que promet le produit, avec des données Bénin.
// La ligne « Cosme » rejoue en boucle le moment magique : le SMS Mobile Money
// collé devient une réception déclarée, sans saisie (statuts rent_receptions).
function ProductPreview() {
  const rows = [
    { name: "Adjovi H.", unit: "Villa 3 ch — Fidjrossè", status: "Payé le 2 juil.", tone: "paid" as const },
    { name: "Rachidatou A.", unit: "Appt 2 ch — Gbégamey", status: "En retard — 12 j", tone: "late" as const },
  ];

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[#d5d5d2] bg-white shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)]">
      <div className="flex items-center justify-between border-b border-[#d5d5d2] px-5 py-4">
        <div className="flex items-center gap-3">
          <RantiLogo size={22} />
          <div>
            <p className="font-display text-sm font-extrabold tracking-tight text-[#292929]">Juillet 2026</p>
            <p className="text-xs text-[#acada8]">6 baux actifs</p>
          </div>
        </div>
        <span className="rounded-full bg-[#e5eacd] px-3 py-1 text-xs font-semibold text-[#292929]">
          3/6 payés
        </span>
      </div>

      <div className="space-y-3 p-5">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-3 rounded-xl border border-[#f2f2ec] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5eacd] text-sm font-bold text-[#292929]">
                {row.name[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#292929]">{row.name}</p>
                <p className="text-xs text-[#72726e]">{row.unit}</p>
              </div>
            </div>
            <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
          </div>
        ))}

        {/* Moment magique animé : SMS MoMo collé → réception déclarée. */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f2f2ec] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5eacd] text-sm font-bold text-[#292929]">
              C
            </div>
            <div>
              <p className="text-sm font-semibold text-[#292929]">Cosme D.</p>
              <p className="text-xs text-[#72726e]">Boutique — Ganhi</p>
            </div>
          </div>
          <span className="lp-paste shrink-0 whitespace-nowrap text-xs font-semibold">
            <span className="lp-paste-track">
              <span className="lp-paste-sms">SMS MoMo collé…</span>
              <span className="lp-paste-done">Déclaré le 5 juil.</span>
              <span className="lp-paste-sms">SMS MoMo collé…</span>
            </span>
            <span className="sr-only">SMS Mobile Money collé, réception déclarée le 5 juillet</span>
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-[#f2f6e1] px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#292929] text-[#f7f7f2]">
            <MessageCircle size={16} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#292929]">Relance prête pour Rachidatou</p>
            <p className="text-xs text-[#72726e]">Message préparé · à envoyer sur WhatsApp</p>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-dashed border-[#d5d5d2] pt-4">
          <span className="text-sm text-[#72726e]">Encaissé ce mois</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-[#292929] [font-variant-numeric:tabular-nums]">175 000 F</span>
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    title: "Renseignez vos baux une seule fois",
    detail: "Loyer, échéance, numéro du locataire. Ranti génère les échéances chaque mois.",
  },
  {
    title: "Ranti prépare la relance au bon moment",
    detail: "Avant l'échéance, puis en cas de retard. Le message part sur WhatsApp d'un geste.",
  },
  {
    title: "Dictez le paiement, la quittance suit",
    detail: "Vous dictez ou collez le SMS Mobile Money, Ranti remplit et vous validez.",
  },
];

const faq = [
  [
    "Comment enregistrer un paiement ?",
    "Vous le dictez : « Koffi a payé son loyer de juillet ». Ou vous collez le SMS Mobile Money reçu, Ranti en extrait le montant, la date et la référence. Dans les deux cas, il reconnaît le bail et prépare l'encaissement. Vous relisez, vous validez. Pas de micro ? Le formulaire reste là.",
  ],
  [
    "Ranti encaisse-t-il l'argent ?",
    "Comme vous voulez. Par défaut, l'argent circule directement entre vous et votre locataire (cash, Mobile Money, virement) et Ranti garde le suivi et les preuves. Si vous préférez, Ranti peut encaisser pour vous : votre locataire paie via notre partenaire de paiement agréé, qui vous reverse 95 % du loyer, et la quittance certifiée se génère toute seule. Dans les deux cas, Ranti ne détient jamais vos fonds.",
  ],
  [
    "Votre locataire doit-il créer un compte ?",
    "Non. Votre espace reste privé. Votre locataire reçoit un simple lien pour confirmer un paiement ou un reçu.",
  ],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#292929]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d5d5d2] bg-[#f7f7f2]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <RantiLogo size={30} />
            <span className="font-display text-lg font-extrabold tracking-tight">Ranti</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#72726e] md:flex">
            <a href="#fonctionnement" className="transition hover:text-[#292929]">Fonctionnement</a>
            <a href="#preuve" className="transition hover:text-[#292929]">Preuve</a>
            <a href="#tarif" className="transition hover:text-[#292929]">Tarif</a>
            <a href="#faq" className="transition hover:text-[#292929]">Questions</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-[#292929] transition hover:bg-[#f2f6e1] sm:block">
              Se connecter
            </Link>
            <Link href={SIGNUP_HREF} className="rounded-full bg-[#5b6f00] px-5 py-2.5 text-sm font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:bg-[#4c5616]">
              Gérer vos loyers
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden px-6 pb-28 pt-36 md:pb-44 md:pt-56">
          <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
            <div>
              <h1 className="lp-rise font-display max-w-3xl text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] text-[#292929] sm:text-5xl md:text-6xl">
                Le registre de loyer des propriétaires africains.
              </h1>

              <p className="lp-rise lp-rise-2 mt-7 max-w-md text-lg leading-[1.35] text-[#72726e]">
                Chaque loyer, Ranti le{" "}
                <span className="lp-roll" aria-hidden="true">
                  <span className="lp-roll-track">
                    <span>suit.</span>
                    <span>prouve.</span>
                    <span>suit.</span>
                  </span>
                </span>
                <span className="sr-only">suit et prouve.</span>
              </p>
              <p className="lp-rise lp-rise-3 mt-2 max-w-md text-lg leading-8 text-[#72726e]">
                Vous validez, Ranti garde la trace de tout.
              </p>

              <div className="lp-rise lp-rise-3 mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
                <Link href={SIGNUP_HREF} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5b6f00] px-7 py-4 text-base font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-[#4c5616] hover:shadow-[0_16px_34px_-12px_rgba(91,111,0,0.55)]">
                  Gérer vos loyers
                  <ArrowRight size={18} strokeWidth={1.8} />
                </Link>
                <a href="#fonctionnement" className="text-base font-semibold text-[#72726e] underline-offset-4 transition hover:text-[#292929] hover:underline">
                  Voir comment ça marche
                </a>
              </div>

              <div className="lp-rise lp-rise-4 mt-7 flex flex-wrap gap-3 text-sm text-[#72726e]">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#292929] px-3 py-2 font-semibold text-[#f7f7f2]">
                  <ShieldCheck size={15} strokeWidth={1.8} className="text-[#94f27f]" />
                  Ranti ne détient jamais vos fonds
                </span>
                {["Gratuit pendant le pilote", "Sans carte bancaire"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-[#d5d5d2] bg-white px-3 py-2">
                    <Check size={15} strokeWidth={1.8} className="text-[#5b6f00]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Démo au centre : la vidéo (quand fournie) sinon la carte produit
                ambiante, façon granola — déborde à droite, légère inclinaison. */}
            <div className="lp-slide-in lg:translate-x-6 lg:rotate-[1.5deg] lg:will-change-transform xl:-mr-20">
              <HeroMedia />
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="px-6 py-24 md:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#788c15]">Simple au quotidien</p>
            <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#292929] md:text-5xl [text-wrap:balance]">
              Vos loyers se suivent en trois gestes simples.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#72726e]">
              Vous ne devenez pas comptable. Ranti garde la mémoire fiable de vos loyers, de vos retards et de vos reçus, dans un journal que vous lisez d'un coup d'œil.
            </p>
          </div>

          <ol className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[#d5d5d2] bg-white p-6 shadow-[0_1px_2px_rgba(41,41,41,0.06)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#292929] text-sm font-semibold text-[#f7f7f2]">
                  {index + 1}
                </span>
                <p className="font-display mt-4 text-lg font-extrabold tracking-tight text-[#292929]">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#72726e]">{step.detail}</p>
              </li>
            ))}
          </ol>

          <p className="mx-auto mt-12 max-w-2xl text-center text-base leading-8 text-[#72726e]">
            <span className="font-semibold text-[#292929]">Ranti remplace le cahier, WhatsApp et Excel</span>, sans en perdre la simplicité.
          </p>
        </section>

        <section id="preuve" className="px-6 pb-24">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#292929] px-8 py-16 text-[#f7f7f2] shadow-[0_30px_90px_rgba(41,41,41,0.24)] md:px-16 md:py-24">
            <h2 className="font-display max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-[-0.02em] md:text-6xl [text-wrap:balance]">
              Une quittance que votre locataire confirme, et que tout le monde peut vérifier.
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-9 text-[#acada8]">
              Chaque quittance porte un numéro et la confirmation de votre locataire. Avec le lien public, une banque, un futur locataire ou un juge contrôle en quelques secondes qu'elle est authentique.
            </p>
            <Link
              href="/verifier/demo"
              className="group mt-8 inline-flex items-center gap-2 text-base font-semibold text-[#94f27f] underline-offset-4 transition hover:underline"
            >
              Vérifier un exemple de quittance
              <ArrowRight size={18} strokeWidth={2} className="transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* Tarif — modèle « All-Inclusive 5 % » (ADR-018 v4) : commission unique
            de 5 % du brut, net 95 % reversé, frais PSP absorbés par Ranti.
            Exemple canon de la doc : 100 000 F → 5 000 / 95 000. */}
        <section id="tarif" className="px-6 pb-24 pt-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#788c15]">Tarif</p>
            <h2 className="font-display mx-auto mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#292929] md:text-5xl [text-wrap:balance]">
              Vous ne payez que sur les loyers encaissés via Ranti.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#72726e]">
              Pas d'abonnement, pas de carte bancaire. Un seul prélèvement, tout compris.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-lg rounded-[28px] border border-[#d5d5d2] bg-white p-8 text-center shadow-[0_8px_28px_-14px_rgba(41,41,41,0.25)] md:p-10">
            <p className="font-display text-6xl font-extrabold tracking-tight text-[#292929] md:text-7xl">5%</p>
            <p className="mt-2 text-base font-semibold text-[#292929]">par loyer encaissé, quittance comprise</p>

            <div className="mt-7 space-y-3 border-t border-dashed border-[#d5d5d2] pt-6 text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#72726e]">Loyer encaissé</span>
                <span className="font-display text-lg font-extrabold tracking-tight text-[#292929] [font-variant-numeric:tabular-nums]">100 000 F</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#72726e]">Frais tout compris (5 %)</span>
                <span className="text-sm font-semibold text-[#72726e] [font-variant-numeric:tabular-nums]">− 5 000 F</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f2f6e1] px-4 py-3">
                <span className="text-sm font-semibold text-[#292929]">Vous recevez</span>
                <span className="font-display text-xl font-extrabold tracking-tight text-[#5b6f00] [font-variant-numeric:tabular-nums]">95 000 F</span>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-[#72726e]">
              Les 5 % couvrent le paiement Mobile Money (entrée et sortie) et le service Ranti. Le taux que vous voyez est le seul que vous payez.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Sans abonnement", "Sans carte", "Sans frais fixes"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d5d2] bg-[#f7f7f2] px-3 py-1.5 text-xs font-semibold text-[#72726e]">
                  <Check size={13} strokeWidth={2} className="text-[#5b6f00]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-lg text-center text-sm text-[#acada8]">
            Pas de paiement encaissé, pas de commission. Le suivi de vos baux et de vos relances reste gratuit pendant le pilote.
          </p>
        </section>

        <section id="faq" className="px-6 pb-28">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#788c15]">Questions fréquentes</p>
              <h2 className="font-display mt-4 text-4xl font-extrabold tracking-[-0.02em] text-[#292929]">Les questions qu'on nous pose souvent.</h2>
            </div>
            <div className="divide-y divide-[#f2f2ec] rounded-2xl border border-[#d5d5d2] bg-white px-6 shadow-[0_1px_2px_rgba(41,41,41,0.06)]">
              {faq.map(([q, a]) => (
                <details key={q} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-semibold text-[#292929]">
                    {q}
                    <span className="text-[#788c15] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[#72726e]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-[#d5d5d2] bg-white px-8 py-14 text-center shadow-[0_8px_28px_-14px_rgba(41,41,41,0.25)]">
            <h2 className="font-display mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#292929] md:text-5xl [text-wrap:balance]">
              Ouvrez votre registre de loyer.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#72726e]">
              Deux minutes pour créer votre espace. Votre premier bail suivi dès aujourd'hui.
            </p>
            <Link href={SIGNUP_HREF} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#5b6f00] px-8 py-4 text-base font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-[#4c5616] hover:shadow-[0_16px_34px_-12px_rgba(91,111,0,0.55)]">
              Gérer vos loyers
              <ArrowRight size={18} strokeWidth={1.8} />
            </Link>
            <p className="mt-4 text-sm text-[#acada8]">Gratuit pendant le pilote. Aucune carte demandée.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d5d5d2] bg-[#eaebe5] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-[#72726e] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <RantiLogo size={24} />
            <span className="font-display font-extrabold tracking-tight text-[#292929]">Ranti</span>
            <span className="text-[#acada8]">· Le registre de loyer actif</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="transition hover:text-[#292929]">Se connecter</Link>
            <Link href="/conditions" className="transition hover:text-[#292929]">Conditions</Link>
            <Link href="/confidentialite" className="transition hover:text-[#292929]">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
