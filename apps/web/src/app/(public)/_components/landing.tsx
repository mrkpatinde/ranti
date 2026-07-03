/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  FileText,
  Home,
  MessageCircle,
} from "lucide-react";

const SIGNUP_HREF = "/signup";

import { RantiLogo } from "@/components/ranti-logo";

function StatusBadge({ tone, children }: { tone: "paid" | "late" | "declared"; children: React.ReactNode }) {
  const tones = {
    paid: "bg-[#e7f0e9] text-[#163828]",
    late: "bg-[#fee2e2] text-[#b91c1c]",
    declared: "bg-[#f5f5f4] text-[#57534e]",
  };
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

// La carte du mois — l'écran que promet le produit, avec des données Bénin.
function ProductPreview() {
  const rows = [
    { name: "Adjovi H.", unit: "Villa 3 ch — Fidjrossè", status: "Payé le 2 juil.", tone: "paid" as const },
    { name: "Rachidatou A.", unit: "Appt 2 ch — Gbégamey", status: "En retard — 12 j", tone: "late" as const },
    { name: "Cosme D.", unit: "Boutique — Ganhi", status: "Déclaré le 5 juil.", tone: "declared" as const },
  ];

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[#eae0ca] bg-white shadow-[0_14px_50px_-18px_rgba(22,56,40,0.22)]">
      <div className="flex items-center justify-between border-b border-[#eae0ca] px-5 py-4">
        <div className="flex items-center gap-3">
          <RantiLogo size={22} />
          <div>
            <p className="font-display text-sm font-extrabold tracking-tight text-[#163828]">Juillet 2026</p>
            <p className="text-xs text-[#a8a29e]">6 baux actifs</p>
          </div>
        </div>
        <span className="rounded-full bg-[#e7f0e9] px-3 py-1 text-xs font-semibold text-[#163828]">
          3/6 payés
        </span>
      </div>

      <div className="space-y-3 p-5">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-3 rounded-xl border border-[#f5f5f4] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e7f0e9] text-sm font-bold text-[#163828]">
                {row.name[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#163828]">{row.name}</p>
                <p className="text-xs text-[#78716c]">{row.unit}</p>
              </div>
            </div>
            <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
          </div>
        ))}

        <div className="flex items-center gap-3 rounded-xl bg-[#f0f4e9] px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#163828] text-[#faf3e5]">
            <MessageCircle size={16} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#163828]">Relance envoyée à Rachidatou</p>
            <p className="text-xs text-[#57534e]">Automatique · SMS · il y a 2 h</p>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-dashed border-[#d8cdb4] pt-4">
          <span className="text-sm text-[#57534e]">Encaissé ce mois</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-[#163828] [font-variant-numeric:tabular-nums]">175 000 F</span>
        </div>
      </div>
    </div>
  );
}

const pillars = [
  {
    icon: <Home size={18} strokeWidth={1.8} />,
    title: "Un registre clair",
    body: "Vos logements, baux, locataires et échéances dans un seul espace simple à comprendre.",
  },
  {
    icon: <Bell size={18} strokeWidth={1.8} />,
    title: "Des relances automatiques",
    body: "Ranti sait quand relancer. Les rappels partent au bon moment, sans que vous y pensiez.",
  },
  {
    icon: <FileText size={18} strokeWidth={1.8} />,
    title: "Des reçus conservés",
    body: "Chaque validation garde une trace. Les corrections sont visibles, jamais cachées.",
  },
];

const steps = [
  {
    title: "Renseignez vos logements, locataires et baux.",
    detail: "Une fois. Loyer, date d'échéance, numéro du locataire.",
  },
  {
    title: "Ranti génère les échéances du mois.",
    detail: "Chaque bail actif produit ses loyers attendus, sans saisie.",
  },
  {
    title: "Les relances partent automatiquement.",
    detail: "Avant l'échéance, puis en cas de retard. Vous n'y pensez plus.",
  },
  {
    title: "Vous confirmez l'encaissement, la quittance est prête.",
    detail: "Un document numéroté, daté, conservé dans le registre.",
  },
];

const faq = [
  [
    "Ranti encaisse-t-il l'argent ?",
    "Non. L'argent reste entre vous et votre locataire : cash, Mobile Money ou virement. Ranti organise le suivi et les preuves.",
  ],
  [
    "Le locataire doit-il créer un compte ?",
    "Non. Le propriétaire garde son espace privé. Le locataire peut recevoir un lien simple quand une action est nécessaire.",
  ],
  [
    "Pourquoi un registre de loyer ?",
    "Parce que les loyers deviennent vite sensibles : retards, preuves, reçus, oublis. Ranti garde une mémoire propre.",
  ],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#faf3e5] text-[#163828]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#eae0ca] bg-[#faf3e5]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <RantiLogo size={30} />
            <span className="font-display text-lg font-extrabold tracking-tight">Ranti</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#57534e] md:flex">
            <a href="#fonctionnement" className="transition hover:text-[#163828]">Fonctionnement</a>
            <a href="#confiance" className="transition hover:text-[#163828]">Avantages</a>
            <a href="#faq" className="transition hover:text-[#163828]">Questions</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-[#163828] transition hover:bg-[#f0f4e9] sm:block">
              Se connecter
            </Link>
            <Link href={SIGNUP_HREF} className="rounded-full bg-[#f2a33c] px-5 py-2.5 text-sm font-semibold text-[#3a2407] shadow-[0_6px_16px_-6px_rgba(242,163,60,0.55)] transition hover:bg-[#e18f1f]">
              Créer mon espace
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-6 pb-20 pt-32 md:pb-28 md:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <h1 className="lp-rise font-display max-w-3xl text-5xl font-extrabold leading-[1.06] tracking-[-0.03em] text-[#163828] sm:text-6xl md:text-7xl">
                Qui a payé. Qui doit.
                <br />
                <span className="whitespace-nowrap">
                  Ranti{" "}
                  <span className="lp-roll" aria-hidden="true">
                    <span className="lp-roll-track">
                      <span>relance</span>
                      <span>suit</span>
                      <span>prouve</span>
                      <span>relance</span>
                    </span>
                  </span>
                  <span className="sr-only">relance</span>
                </span>
                <br />
                pour vous.
              </h1>

              <p className="lp-rise lp-rise-2 mt-7 max-w-xl text-lg leading-8 text-[#57534e]">
                Le registre de loyer des propriétaires africains. Vous renseignez le bail une fois : Ranti suit les échéances, relance au bon moment et garde chaque quittance.
              </p>

              <div className="lp-rise lp-rise-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={SIGNUP_HREF} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f2a33c] px-7 py-4 text-base font-semibold text-[#3a2407] shadow-[0_6px_16px_-6px_rgba(242,163,60,0.55)] transition hover:bg-[#e18f1f]">
                  Créer mon espace
                  <ArrowRight size={18} strokeWidth={1.8} />
                </Link>
                <a href="#fonctionnement" className="inline-flex items-center justify-center rounded-full border border-[#163828] px-7 py-4 text-base font-semibold text-[#163828] transition hover:bg-[#f0f4e9]">
                  Voir comment ça marche
                </a>
              </div>

              <div className="lp-rise lp-rise-4 mt-7 flex flex-wrap gap-3 text-sm text-[#57534e]">
                {["Gratuit pendant le pilote", "Sans carte bancaire"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-[#eae0ca] bg-white px-3 py-2">
                    <Check size={15} strokeWidth={1.8} className="text-[#235a41]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="lp-rise lp-rise-3">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section id="confiance" className="px-6 py-10">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {pillars.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#eae0ca] bg-white p-7 shadow-[0_1px_2px_rgba(22,56,40,0.06)]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f0e9] text-[#163828]">
                  {item.icon}
                </div>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-[#163828]">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#57534e]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnement" className="px-6 py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#b87413]">Simple au quotidien</p>
              <h2 className="font-display mt-4 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#163828] md:text-5xl [text-wrap:balance]">
                Pas un logiciel lourd. Un rituel clair pour vos loyers.
              </h2>
              <p className="mt-5 text-base leading-8 text-[#57534e]">
                L'objectif n'est pas de transformer un propriétaire en comptable. Ranti garde juste la mémoire fiable des loyers, des retards et des reçus.
              </p>
            </div>

            <div className="rounded-2xl border border-[#eae0ca] bg-white p-4 shadow-[0_8px_28px_-14px_rgba(22,56,40,0.25)]">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-4 rounded-xl p-5 transition hover:bg-[#faf3e5]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#163828] text-sm font-semibold text-[#faf3e5]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-[#163828]">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#57534e]">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#163828] p-8 text-[#faf3e5] shadow-[0_30px_90px_rgba(22,56,40,0.24)] md:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#f2a33c]">Pourquoi Ranti</p>
                <h2 className="font-display mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.02em] md:text-5xl [text-wrap:balance]">
                  Vous oubliez moins. Vous encaissez plus.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Relances", "Elles partent automatiquement au bon moment. Vous voyez ce que Ranti a déjà relancé."],
                  ["Preuves", "Les confirmations, reçus et annulations restent historisés."],
                  ["Contrôle", "Ranti ne touche jamais votre argent sans votre validation."],
                  ["Clarté", "Un propriétaire comprend son mois en quelques secondes."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-[#faf3e5]/10 bg-[#faf3e5]/5 p-5">
                    <p className="font-display font-extrabold tracking-tight">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#9fb8a8]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="px-6 pb-28">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#b87413]">Questions fréquentes</p>
              <h2 className="font-display mt-4 text-4xl font-extrabold tracking-[-0.02em] text-[#163828]">Ranti reste volontairement simple.</h2>
            </div>
            <div className="divide-y divide-[#f5f5f4] rounded-2xl border border-[#eae0ca] bg-white px-6 shadow-[0_1px_2px_rgba(22,56,40,0.06)]">
              {faq.map(([q, a]) => (
                <details key={q} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-semibold text-[#163828]">
                    {q}
                    <span className="text-[#b87413] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#57534e]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-[#eae0ca] bg-white px-8 py-14 text-center shadow-[0_8px_28px_-14px_rgba(22,56,40,0.25)]">
            <h2 className="font-display mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#163828] md:text-5xl [text-wrap:balance]">
              Ouvrez votre registre de loyer.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#57534e]">
              Deux minutes pour créer votre espace. Votre premier bail suivi dès aujourd'hui.
            </p>
            <Link href={SIGNUP_HREF} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#f2a33c] px-8 py-4 text-base font-semibold text-[#3a2407] shadow-[0_6px_16px_-6px_rgba(242,163,60,0.55)] transition hover:bg-[#e18f1f]">
              Créer mon espace
              <ArrowRight size={18} strokeWidth={1.8} />
            </Link>
            <p className="mt-4 text-sm text-[#a8a29e]">Gratuit pendant le pilote. Aucune carte demandée.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#eae0ca] bg-[#f4ebd8] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-[#57534e] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <RantiLogo size={24} />
            <span className="font-display font-extrabold tracking-tight text-[#163828]">Ranti</span>
            <span className="text-[#a8a29e]">· Le registre de loyer actif</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="transition hover:text-[#163828]">Se connecter</Link>
            <Link href="/conditions" className="transition hover:text-[#163828]">Conditions</Link>
            <Link href="/confidentialite" className="transition hover:text-[#163828]">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
