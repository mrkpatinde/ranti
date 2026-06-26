import Link from "next/link"

const rentRows = [
  {
    tenant: "Awa K.",
    unit: "Appartement 2",
    amount: "85 000 F",
    status: "Payé",
    proof: "Preuve reçue",
    tone: "bg-emerald-100 text-emerald-800",
  },
  {
    tenant: "Daniel M.",
    unit: "Boutique",
    amount: "120 000 F",
    status: "En retard",
    proof: "Relance à préparer",
    tone: "bg-amber-100 text-amber-900",
  },
  {
    tenant: "Binta S.",
    unit: "Chambre 4",
    amount: "35 000 F",
    status: "Partiel",
    proof: "Capture reçue",
    tone: "bg-orange-100 text-orange-900",
  },
]

const promises = [
  {
    title: "Voir les loyers du mois",
    text: "Qui a payé, qui reste dû, qui doit être relancé proprement.",
  },
  {
    title: "Garder les preuves",
    text: "Capture Mobile Money, reçu manuel, confirmation du propriétaire : chaque paiement garde sa trace.",
  },
  {
    title: "Préserver la relation",
    text: "Avant d’appeler ou d’écrire, le propriétaire parle avec des faits clairs.",
  },
]

const steps = [
  "Ajoutez vos biens et logements.",
  "Suivez les paiements chaque mois.",
  "Relancez avec calme quand un loyer manque.",
]

const realities = [
  "Cash",
  "Mobile Money",
  "Virement",
  "WhatsApp",
  "Appels",
  "Preuves par capture",
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7ed] text-[#21160f]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-[#f59e0b]/25 blur-3xl" />
        <div className="absolute right-0 top-36 h-[28rem] w-[28rem] rounded-full bg-[#16a34a]/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-[#7c2d12]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-[#e7c99c]/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#166534] text-lg font-black text-white shadow-lg shadow-[#166534]/20">
              R
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#166534]">
                Ranti
              </p>
              <p className="text-xs font-medium text-[#8a684d]">
                Espace propriétaire
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="rounded-full bg-[#f7ead8] px-4 py-2 text-sm font-bold text-[#7c4a16] transition hover:bg-[#efd6b4]"
          >
            Se connecter
          </Link>
        </header>

        <section className="grid min-h-[calc(100vh-6rem)] items-center gap-12 py-14 lg:grid-cols-[1fr_0.95fr] lg:py-20">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-[#166534] shadow-sm ring-1 ring-[#166534]/10">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
              Pensé pour les propriétaires africains de 1 à 20 logements
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#21160f] sm:text-6xl lg:text-7xl">
                La gestion des loyers, claire pour vous et juste pour vos locataires.
              </h1>
              <p className="max-w-2xl text-xl leading-9 text-[#6f4b2f]">
                Ranti aide le propriétaire à suivre les paiements, les retards, les preuves et les reçus, même quand le loyer est payé en cash, par Mobile Money ou par virement.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:max-w-xl sm:flex-row">
              <Link
                href="/signup"
                className="rounded-2xl bg-[#166534] px-6 py-4 text-center text-base font-black text-white shadow-xl shadow-[#166534]/25 transition hover:-translate-y-0.5 hover:bg-[#14532d]"
              >
                Ouvrir mon espace propriétaire
              </Link>
              <a
                href="#fonctionnement"
                className="rounded-2xl border border-[#d6a35c]/60 bg-white/75 px-6 py-4 text-center text-base font-black text-[#7c4a16] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Voir comment ça marche
              </a>
            </div>

            <div className="grid max-w-2xl grid-cols-3 gap-3 pt-2">
              <div className="rounded-3xl bg-white/75 p-4 shadow-sm ring-1 ring-[#e7c99c]/60">
                <p className="text-3xl font-black text-[#166534]">12</p>
                <p className="mt-1 text-sm font-semibold text-[#8a684d]">loyers suivis</p>
              </div>
              <div className="rounded-3xl bg-white/75 p-4 shadow-sm ring-1 ring-[#e7c99c]/60">
                <p className="text-3xl font-black text-[#92400e]">3</p>
                <p className="mt-1 text-sm font-semibold text-[#8a684d]">retards visibles</p>
              </div>
              <div className="rounded-3xl bg-white/75 p-4 shadow-sm ring-1 ring-[#e7c99c]/60">
                <p className="text-3xl font-black text-[#7c2d12]">9</p>
                <p className="mt-1 text-sm font-semibold text-[#8a684d]">preuves gardées</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-[#166534] via-[#d97706] to-[#7c2d12] opacity-30 blur-2xl" />
            <div className="relative rounded-[2rem] border border-[#14532d]/20 bg-[#14532d] p-4 shadow-2xl shadow-[#14532d]/30">
              <div className="rounded-[1.5rem] bg-[#fffaf2] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#efd8b8] pb-5">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a6a2f]">
                      Vue propriétaire
                    </p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-[#21160f]">
                      Loyers de juin
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-[#8a684d]">
                      Maison Tokpa · 8 logements
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#dcfce7] px-4 py-3 text-right text-[#166534]">
                    <p className="text-2xl font-black">5/8</p>
                    <p className="text-xs font-bold">payés</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {rentRows.map((row) => (
                    <div
                      key={row.tenant}
                      className="rounded-3xl border border-[#efd8b8] bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-black text-[#21160f]">{row.tenant}</p>
                          <p className="mt-1 text-sm font-semibold text-[#8a684d]">
                            {row.unit} · {row.amount}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${row.tone}`}>
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-4 rounded-2xl bg-[#fff3df] px-4 py-3 text-sm font-bold text-[#7c4a16]">
                        {row.proof}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-3xl bg-[#21160f] p-4 text-white">
                  <p className="text-sm font-bold text-[#fde68a]">Message préparé</p>
                  <p className="mt-2 text-sm leading-6 text-[#fff7ed]">
                    Bonjour Daniel, le loyer de juin reste en attente. Pouvez-vous me confirmer le paiement ou m’envoyer la preuve ?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-3">
          {promises.map((promise) => (
            <div
              key={promise.title}
              className="rounded-[2rem] bg-white/75 p-6 shadow-sm ring-1 ring-[#e7c99c]/70"
            >
              <h3 className="text-xl font-black tracking-tight text-[#21160f]">
                {promise.title}
              </h3>
              <p className="mt-3 text-base leading-7 text-[#6f4b2f]">
                {promise.text}
              </p>
            </div>
          ))}
        </section>

        <section
          id="fonctionnement"
          className="grid gap-8 rounded-[2.5rem] bg-[#21160f] p-6 text-white shadow-2xl shadow-[#21160f]/20 md:grid-cols-[0.9fr_1.1fr] md:p-10"
        >
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#fde68a]">
              Comment Ranti aide
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight">
              Une gestion simple, chaque mois.
            </h2>
          </div>
          <div className="grid gap-4">
            {steps.map((step, index) => (
              <div
                key={step}
                className="flex gap-4 rounded-3xl bg-white/10 p-5 ring-1 ring-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fde68a] text-sm font-black text-[#21160f]">
                  {index + 1}
                </span>
                <p className="text-lg font-bold leading-7 text-[#fff7ed]">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12">
          <div className="rounded-[2.5rem] border border-[#e7c99c] bg-white/70 p-6 shadow-sm md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#166534]">
              Réalités terrain
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {realities.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-[#f7ead8] px-4 py-2 text-sm font-black text-[#7c4a16]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
