/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  FileText,
  Home,
  MessageCircle,
  Shield,
} from "lucide-react";

const SIGNUP_HREF = "/signup";

function RantiLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#244334" />
      <rect x="8" y="10" width="16" height="2.6" rx="1.3" fill="#F7EFE2" />
      <rect x="8" y="15" width="12" height="2.6" rx="1.3" fill="#F7EFE2" />
      <rect x="8" y="20" width="8" height="2.6" rx="1.3" fill="#F7EFE2" />
    </svg>
  );
}

function ProductPreview() {
  const rows = [
    { name: "Aline", unit: "Chambre 1", status: "Payé", tone: "green" },
    { name: "Koffi", unit: "Boutique", status: "En retard", tone: "amber" },
    { name: "Mireille", unit: "Appartement", status: "Reçu prêt", tone: "green" },
  ];

  return (
    <div className="relative">
      <div className="absolute -left-8 -top-8 hidden h-24 w-24 rounded-full bg-[#d7e7cf] blur-2xl md:block" />
      <div className="absolute -bottom-10 -right-8 hidden h-28 w-28 rounded-full bg-[#e7c9a4] blur-2xl md:block" />

      <div className="relative overflow-hidden rounded-[2rem] border border-[#dccfbd] bg-[#fffaf1] shadow-[0_30px_90px_rgba(83,65,42,0.14)]">
        <div className="flex items-center justify-between border-b border-[#eadfcc] bg-[#f5ecdc] px-5 py-4">
          <div className="flex items-center gap-3">
            <RantiLogo size={22} />
            <div>
              <p className="text-sm font-semibold text-[#26382d]">Registre de loyer</p>
              <p className="text-xs text-[#7f725f]">Juin 2026</p>
            </div>
          </div>
          <span className="rounded-full bg-[#dff0dc] px-3 py-1 text-xs font-semibold text-[#315c42]">
            3/4 payés
          </span>
        </div>

        <div className="grid grid-cols-3 gap-px bg-[#eadfcc]">
          {[
            ["Attendus", "4"],
            ["Payés", "3"],
            ["Retard", "1"],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#fffaf1] px-5 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9b8c75]">{label}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-[#26382d]">{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 p-5">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between rounded-2xl border border-[#eee1cf] bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3e8] text-sm font-semibold text-[#315c42]">
                  {row.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#26382d]">{row.name}</p>
                  <p className="text-xs text-[#7f725f]">{row.unit}</p>
                </div>
              </div>
              <span className={row.tone === "green"
                ? "rounded-full bg-[#e4f3df] px-3 py-1 text-xs font-semibold text-[#315c42]"
                : "rounded-full bg-[#fff1c9] px-3 py-1 text-xs font-semibold text-[#7d5b10]"
              }>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const pillars = [
  {
    icon: <Home size={18} />,
    title: "Un registre clair",
    body: "Vos logements, baux, locataires et échéances dans un seul espace simple à comprendre.",
  },
  {
    icon: <Bell size={18} />,
    title: "Des relances propres",
    body: "Ranti aide à rappeler sans tension, avec un suivi clair de ce qui reste dû.",
  },
  {
    icon: <FileText size={18} />,
    title: "Des reçus conservés",
    body: "Chaque validation garde une trace. Les corrections sont visibles, jamais cachées.",
  },
];

const steps = [
  "Ajoutez vos logements et locataires.",
  "Ranti génère les échéances du mois.",
  "Vous confirmez les encaissements reçus.",
  "Les reçus et l'historique restent disponibles.",
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
    <div className="min-h-screen overflow-hidden bg-[#f7efe2] text-[#26382d]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e5d8c5]/80 bg-[#f7efe2]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <RantiLogo size={30} />
            <span className="text-lg font-semibold tracking-tight">Ranti</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#6f634f] md:flex">
            <a href="#fonctionnement" className="transition hover:text-[#26382d]">Fonctionnement</a>
            <a href="#confiance" className="transition hover:text-[#26382d]">Confiance</a>
            <a href="#faq" className="transition hover:text-[#26382d]">Questions</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-[#6f634f] transition hover:text-[#26382d] sm:block">
              Se connecter
            </Link>
            <Link href={SIGNUP_HREF} className="rounded-full bg-[#244334] px-5 py-2.5 text-sm font-semibold text-[#fff8eb] shadow-sm transition hover:bg-[#1d362a]">
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-6 pb-20 pt-32 md:pb-28 md:pt-40">
          <div className="absolute left-1/2 top-16 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#e7d5b9] opacity-50 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d9c9b3] bg-[#fff9ef]/70 px-4 py-2 text-sm font-semibold text-[#5e6f43] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#7ea05f]" />
                Conçu pour les propriétaires africains
              </div>

              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#26382d] sm:text-6xl md:text-7xl">
                Vos loyers, suivis avec calme.
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-[#695f4f] md:text-xl">
                Ranti remplace le désordre WhatsApp, les notes papier et les oublis par un registre de loyer clair : qui a payé, qui doit, quoi relancer, quel reçu garder.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={SIGNUP_HREF} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#244334] px-7 py-4 text-base font-semibold text-[#fff8eb] shadow-[0_16px_34px_rgba(36,67,52,0.22)] transition hover:bg-[#1d362a]">
                  Commencer à suivre mes loyers
                  <ArrowRight size={18} />
                </Link>
                <a href="#fonctionnement" className="inline-flex items-center justify-center rounded-full border border-[#d7c7ae] bg-[#fff9ef]/70 px-7 py-4 text-base font-semibold text-[#34493b] transition hover:bg-[#fffaf1]">
                  Voir comment ça marche
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-3 text-sm text-[#6f634f]">
                {['Sans carte bancaire', 'Mobile-first', 'Cash · Mobile Money · Virement'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full bg-[#fff9ef]/70 px-3 py-2">
                    <Check size={15} className="text-[#63814d]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section id="confiance" className="px-6 py-10">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {pillars.map((item) => (
              <div key={item.title} className="rounded-[1.75rem] border border-[#dfd0bb] bg-[#fff9ef]/75 p-7 shadow-[0_18px_50px_rgba(92,72,44,0.08)]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7f0dc] text-[#315c42]">
                  {item.icon}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-[#26382d]">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#6f634f]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnement" className="px-6 py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#7b8d53]">Simple au quotidien</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#26382d] md:text-5xl">
                Pas un logiciel lourd. Un rituel clair pour vos loyers.
              </h2>
              <p className="mt-5 text-base leading-8 text-[#6f634f]">
                L’objectif n’est pas de transformer un propriétaire en comptable. Ranti garde juste la mémoire fiable des loyers, des retards et des reçus.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#dfd0bb] bg-[#fff9ef] p-4 shadow-[0_22px_70px_rgba(92,72,44,0.1)]">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-3xl p-5 transition hover:bg-[#f4ead9]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#244334] text-sm font-semibold text-[#fff8eb]">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <p className="font-semibold text-[#26382d]">{step}</p>
                    <p className="mt-1 text-sm leading-6 text-[#736754]">
                      Une action simple, tracée proprement dans le registre.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto overflow-hidden rounded-[2.2rem] bg-[#244334] p-8 text-[#fff8eb] shadow-[0_30px_90px_rgba(36,67,52,0.24)] md:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#cbd9bd]">Promesse produit</p>
                <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
                  Avec nous, tu oublies moins. Donc tu encaisses plus.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Relances', 'Des rappels propres, sans improviser chaque fin de mois.'],
                  ['Preuves', 'Les confirmations, reçus et annulations restent historisés.'],
                  ['Contrôle', 'Ranti ne touche jamais votre argent sans votre validation.'],
                  ['Clarté', 'Un propriétaire comprend son mois en quelques secondes.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-3xl border border-white/10 bg-white/8 p-5">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#dbe4d1]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="px-6 pb-28">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#7b8d53]">Questions fréquentes</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#26382d]">Ranti reste volontairement simple.</h2>
            </div>
            <div className="divide-y divide-[#e4d5bf] rounded-[2rem] border border-[#dfd0bb] bg-[#fff9ef]/80 px-6 shadow-[0_18px_60px_rgba(92,72,44,0.08)]">
              {faq.map(([q, a]) => (
                <details key={q} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-semibold text-[#26382d]">
                    {q}
                    <span className="text-[#7b8d53] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f634f]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfd0bb] bg-[#efe4d1] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-[#6f634f] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <RantiLogo size={24} />
            <span className="font-semibold text-[#26382d]">Ranti</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <span>Registre de loyer moderne</span>
            <span>·</span>
            <span>Pour propriétaires africains</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
