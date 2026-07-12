/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  Mic,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";

const SIGNUP_HREF = "/signup";

import { RantiLogo } from "@/components/ranti-logo";

function StatusBadge({ tone, children }: { tone: "paid" | "late" | "declared"; children: React.ReactNode }) {
  const tones = {
    paid: "bg-[#e5eacd] text-[#292929]",
    late: "bg-[#ffe7e2] text-[#bd4a30]",
    declared: "bg-[#f2f2ec] text-[#72726e]",
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

const pillars = [
  {
    icon: <Mic size={18} strokeWidth={1.8} />,
    title: "Je dicte ou je colle, Ranti prépare",
    body: "Je dis « Koffi a payé son loyer de juillet » — ou je colle le SMS Mobile Money reçu. Ranti remplit la fiche depuis mon bail. Je relis, je valide. Aucun formulaire à saisir.",
  },
  {
    icon: <Bell size={18} strokeWidth={1.8} />,
    title: "La relance est prête, j'envoie d'un geste",
    body: "Ranti sait quand relancer, depuis le bail, et me prépare le message. Je l'envoie sur WhatsApp en un geste — la relation reste entre mon locataire et moi.",
  },
  {
    icon: <ShieldCheck size={18} strokeWidth={1.8} />,
    title: "Une preuve à deux voix",
    body: "Mon locataire confirme le reçu à son tour. Deux voix concordantes : une quittance que personne ne réécrit seul.",
  },
];

const steps = [
  {
    title: "Je renseigne mes baux une fois.",
    detail: "Loyer, échéance, numéro du locataire. Ranti génère les échéances du mois, sans saisie.",
  },
  {
    title: "Ranti me prépare la relance au bon moment.",
    detail: "Avant l'échéance, puis en cas de retard, le message est prêt. Je l'envoie sur WhatsApp, avec mes mots si je veux.",
  },
  {
    title: "Je dicte — ou je colle le SMS MoMo. Ranti remplit, je valide.",
    detail: "Une note vocale, deux mots, ou le SMS Mobile Money collé tel quel. Ranti reconnaît le bail et prépare l'encaissement. Rien n'est écrit sans ma validation.",
  },
  {
    title: "Mon locataire confirme : la quittance est certifiée.",
    detail: "Il ouvre le reçu et confirme l'exactitude. Deux voix, un document daté que personne ne réécrit seul.",
  },
  {
    title: "Mon journal de bord garde tout.",
    detail: "Baux, paiements, retards, reçus, relances : un seul fil chronologique. Tout est là, daté, dans l'ordre.",
  },
];

const faq = [
  [
    "Comment j'enregistre un paiement ?",
    "Je le dis, tout simplement : « Koffi a payé son loyer de juillet ». Ou je colle le SMS Mobile Money reçu — Ranti en extrait le montant, la date et la référence. Dans les deux cas, il reconnaît le bail dans mon registre et prépare l'encaissement. Je relis et je valide. Pas de micro ? Le formulaire reste là.",
  ],
  [
    "Et si je reçois le loyer par Mobile Money ?",
    "Je copie le SMS de confirmation MoMo et je le colle dans Ranti. Ranti retrouve le bail, la référence de transaction est conservée avec l'encaissement, et un même SMS collé deux fois est rejeté. Aucune double saisie possible.",
  ],
  [
    "Ranti peut-il se tromper ?",
    "Ranti propose, je dispose. Rien n'est écrit sans ma validation, et Ranti vérifie toujours que le bail reconnu est bien l'un des miens. Un doute : je corrige avant de valider.",
  ],
  [
    "Mon locataire peut-il contester un reçu ?",
    "Oui. Il confirme l'exactitude (le reçu devient certifié) ou signale une erreur. Les deux versions coexistent sur le document. Ranti documente le désaccord, il ne tranche pas.",
  ],
  [
    "Ranti encaisse-t-il l'argent ?",
    "Non. L'argent reste entre mon locataire et moi : cash, Mobile Money ou virement. Ranti organise le suivi et les preuves.",
  ],
  [
    "Mon locataire doit-il créer un compte ?",
    "Non. Je garde mon espace privé. Mon locataire reçoit un lien simple pour confirmer un paiement ou un reçu.",
  ],
];

// Comparatif honnête : les vraies alternatives du propriétaire (cahier, WhatsApp, Excel).
// Une valeur "yes" = coche verte, "no" = croix grise, tout le reste = note nuancée.
const comparisonRows = [
  {
    feature: "Voir qui a payé et qui doit, en un coup d'œil",
    ranti: "yes",
    cahier: "À recompter à la main",
    excel: "Si le fichier est à jour",
  },
  {
    feature: "Échéances créées automatiquement depuis le bail",
    ranti: "yes",
    cahier: "no",
    excel: "Saisie manuelle",
  },
  {
    feature: "Relance prête au bon moment, à envoyer sur WhatsApp",
    ranti: "yes",
    cahier: "Je dois y penser et tout rédiger",
    excel: "no",
  },
  {
    feature: "Preuves de paiement rangées avec chaque loyer",
    ranti: "yes",
    cahier: "Éparpillées dans WhatsApp",
    excel: "no",
  },
  {
    feature: "Encaissement dicté à la voix ou collé depuis le SMS MoMo",
    ranti: "yes",
    cahier: "no",
    excel: "no",
  },
  {
    feature: "Reçu confirmé par le locataire (preuve à deux voix)",
    ranti: "yes",
    cahier: "Parole contre parole",
    excel: "no",
  },
  {
    feature: "Historique fiable, corrections toujours visibles",
    ranti: "yes",
    cahier: "Ratures et pages perdues",
    excel: "Écrasé sans trace",
  },
];

function CompareCell({ value }: { value: string }) {
  if (value === "yes") {
    return (
      <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#e5eacd]">
        <Check size={16} strokeWidth={2.4} className="text-[#5b6f00]" />
        <span className="sr-only">Oui</span>
      </span>
    );
  }
  if (value === "no") {
    return (
      <>
        <X size={17} strokeWidth={2} className="mx-auto text-[#d5d5d2]" />
        <span className="sr-only">Non</span>
      </>
    );
  }
  return <span className="block text-xs leading-snug text-[#9e9e99]">{value}</span>;
}

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
            <a href="#confiance" className="transition hover:text-[#292929]">Avantages</a>
            <a href="#comparaison" className="transition hover:text-[#292929]">Comparatif</a>
            <a href="#faq" className="transition hover:text-[#292929]">Questions</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-[#292929] transition hover:bg-[#f2f6e1] sm:block">
              Se connecter
            </Link>
            <Link href={SIGNUP_HREF} className="rounded-full bg-[#5b6f00] px-5 py-2.5 text-sm font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition hover:bg-[#4c5616]">
              Gérer mes loyers
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden px-6 pb-28 pt-36 md:pb-44 md:pt-56">
          <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
            <div>
              <h1 className="lp-rise font-display max-w-3xl text-5xl font-extrabold leading-[1.06] tracking-[-0.03em] text-[#292929] sm:text-6xl md:text-7xl">
                Qui a payé. Qui doit.
                <br />
                <span className="whitespace-nowrap">
                  Ranti{" "}
                  <span className="lp-roll" aria-hidden="true">
                    <span className="lp-roll-track">
                      <span>suit</span>
                      <span>prépare</span>
                      <span>prouve</span>
                      <span>suit</span>
                    </span>
                  </span>
                  <span className="sr-only">suit, prépare et prouve</span>
                </span>
                <br />
                pour moi.
              </h1>

              <p className="lp-rise lp-rise-2 mt-7 max-w-md text-lg leading-8 text-[#72726e]">
                Le registre de loyer des propriétaires africains.
                <br />
                Je dicte ou je colle mon SMS MoMo, Ranti écrit, mon locataire confirme.
              </p>

              <div className="lp-rise lp-rise-3 mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
                <Link href={SIGNUP_HREF} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5b6f00] px-7 py-4 text-base font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-[#4c5616] hover:shadow-[0_16px_34px_-12px_rgba(91,111,0,0.55)]">
                  Gérer mes loyers
                  <ArrowRight size={18} strokeWidth={1.8} />
                </Link>
                <a href="#fonctionnement" className="text-base font-semibold text-[#72726e] underline-offset-4 transition hover:text-[#292929] hover:underline">
                  Voir comment ça marche
                </a>
              </div>

              <div className="lp-rise lp-rise-4 mt-7 flex flex-wrap gap-3 text-sm text-[#72726e]">
                {["Gratuit pendant le pilote", "Sans carte bancaire"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-[#d5d5d2] bg-white px-3 py-2">
                    <Check size={15} strokeWidth={1.8} className="text-[#5b6f00]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Visuel produit ambiant, façon granola : déborde vers la droite
                et légère inclinaison, plutôt qu'une carte contenue et droite. */}
            <div className="lp-slide-in lg:translate-x-6 lg:rotate-[1.5deg] lg:will-change-transform xl:-mr-20">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section id="confiance" className="px-6 py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3 md:gap-6">
            {pillars.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#d5d5d2] bg-white p-7 shadow-[0_1px_2px_rgba(41,41,41,0.06)]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e5eacd] text-[#292929]">
                  {item.icon}
                </div>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-[#292929]">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#72726e]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnement" className="px-6 py-24 md:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#788c15]">Simple au quotidien</p>
              <h2 className="font-display mt-4 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#292929] md:text-5xl [text-wrap:balance]">
                Pas un logiciel lourd. Un rituel clair pour mes loyers.
              </h2>
              <p className="mt-5 text-base leading-8 text-[#72726e]">
                Je ne deviens pas comptable. Ranti garde juste la mémoire fiable de mes loyers, de mes retards et de mes reçus — dans un journal de bord que je lis d'un coup d'œil.
              </p>
            </div>

            <div className="rounded-2xl border border-[#d5d5d2] bg-white p-4 shadow-[0_8px_28px_-14px_rgba(41,41,41,0.25)]">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-4 rounded-xl p-5 transition hover:bg-[#f7f7f2]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#292929] text-sm font-semibold text-[#f7f7f2]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-[#292929]">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#72726e]">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="comparaison" className="px-6 py-24 md:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#788c15]">J'ai déjà une méthode</p>
              <h2 className="font-display mt-4 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#292929] md:text-5xl [text-wrap:balance]">
                Ranti remplace le cahier, sans en perdre la simplicité.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#72726e]">
                Cahier, WhatsApp, Excel : ça tient jusqu'au premier oubli ou au premier litige. Voici ce que Ranti garde à ma place.
              </p>
            </div>

            <div className="mt-12 hidden overflow-hidden rounded-[24px] border border-[#d5d5d2] bg-white shadow-[0_8px_28px_-14px_rgba(41,41,41,0.25)] md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-separate border-spacing-0 text-center">
                  <thead>
                    <tr className="bg-[#eaebe5]">
                      <th className="sticky left-0 z-10 bg-[#eaebe5] px-6 py-5 text-left" />
                      <th className="border-x border-[#e5eacd] px-4 py-5">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#292929] px-4 py-2 text-[#f7f7f2]">
                          <RantiLogo size={16} />
                          <span className="font-display text-sm font-extrabold tracking-tight">Ranti</span>
                        </span>
                      </th>
                      <th className="px-4 py-5 text-xs font-bold uppercase tracking-[0.1em] text-[#9e9e99]">Cahier + WhatsApp</th>
                      <th className="px-4 py-5 text-xs font-bold uppercase tracking-[0.1em] text-[#9e9e99]">Tableur Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.feature}>
                        <th scope="row" className="sticky left-0 z-10 border-t border-[#f2f2ec] bg-white px-6 py-5 text-left text-sm font-semibold text-[#292929]">
                          {row.feature}
                        </th>
                        <td className="border-x border-t border-[#e5eacd] bg-[#f2f6e1] px-4 py-5 align-middle">
                          <CompareCell value={row.ranti} />
                        </td>
                        <td className="border-t border-[#f2f2ec] px-4 py-5 align-middle">
                          <CompareCell value={row.cahier} />
                        </td>
                        <td className="border-t border-[#f2f2ec] px-4 py-5 align-middle">
                          <CompareCell value={row.excel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 space-y-4 md:hidden">
              {comparisonRows.map((row) => (
                <div key={row.feature} className="overflow-hidden rounded-2xl border border-[#d5d5d2] bg-white shadow-[0_1px_2px_rgba(41,41,41,0.06)]">
                  <p className="border-b border-[#f2f2ec] bg-[#f7f7f2] px-4 py-3 text-sm font-bold text-[#292929]">
                    {row.feature}
                  </p>
                  <div className="divide-y divide-[#f2f2ec]">
                    <div className="flex items-center justify-between gap-3 bg-[#f2f6e1] px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <RantiLogo size={14} />
                        <span className="font-display text-sm font-extrabold tracking-tight text-[#292929]">Ranti</span>
                      </span>
                      <span className="flex max-w-[52%] shrink-0 items-center justify-end text-right">
                        <CompareCell value={row.ranti} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#9e9e99]">Cahier + WhatsApp</span>
                      <span className="flex max-w-[52%] shrink-0 items-center justify-end text-right">
                        <CompareCell value={row.cahier} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#9e9e99]">Tableur Excel</span>
                      <span className="flex max-w-[52%] shrink-0 items-center justify-end text-right">
                        <CompareCell value={row.excel} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-sm text-[#acada8]">
              Ranti ne touche jamais mon argent. Je valide, Ranti garde la mémoire.
            </p>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#292929] p-8 text-[#f7f7f2] shadow-[0_30px_90px_rgba(41,41,41,0.24)] md:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#94f27f]">Pourquoi Ranti</p>
                <h2 className="font-display mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.02em] md:text-5xl [text-wrap:balance]">
                  J'oublie moins. J'encaisse plus.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Vitesse", "Je dicte ou je colle le SMS MoMo, Ranti remplit. Un loyer enregistré en quelques secondes, sans formulaire."],
                  ["Preuve à deux voix", "Mon locataire confirme le reçu. Certifié, contesté ou en attente : chaque statut est visible."],
                  ["Contrôle", "Ranti propose, je valide. Ranti ne touche jamais mon argent."],
                  ["Clarté", "J'ouvre mon journal de bord et je comprends mon mois en quelques secondes."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-[#f7f7f2]/10 bg-[#f7f7f2]/5 p-5">
                    <p className="font-display font-extrabold tracking-tight">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#acada8]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="px-6 pb-28">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#788c15]">Questions fréquentes</p>
              <h2 className="font-display mt-4 text-4xl font-extrabold tracking-[-0.02em] text-[#292929]">Ranti reste volontairement simple.</h2>
            </div>
            <div className="divide-y divide-[#f2f2ec] rounded-2xl border border-[#d5d5d2] bg-white px-6 shadow-[0_1px_2px_rgba(41,41,41,0.06)]">
              {faq.map(([q, a]) => (
                <details key={q} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-semibold text-[#292929]">
                    {q}
                    <span className="text-[#788c15] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#72726e]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-[#d5d5d2] bg-white px-8 py-14 text-center shadow-[0_8px_28px_-14px_rgba(41,41,41,0.25)]">
            <h2 className="font-display mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#292929] md:text-5xl [text-wrap:balance]">
              J'ouvre mon registre de loyer.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#72726e]">
              Deux minutes pour créer mon espace. Mon premier bail suivi dès aujourd'hui.
            </p>
            <Link href={SIGNUP_HREF} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#5b6f00] px-8 py-4 text-base font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-[#4c5616] hover:shadow-[0_16px_34px_-12px_rgba(91,111,0,0.55)]">
              Gérer mes loyers
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
