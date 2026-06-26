import Link from "next/link"

const rentRows = [
  { name: "Awa K.", unit: "Appartement 2", status: "Payé", proof: "Preuve reçue" },
  { name: "Daniel M.", unit: "Boutique", status: "En retard", proof: "À relancer" },
  { name: "Binta S.", unit: "Chambre 4", status: "Partiel", proof: "Capture reçue" },
]

const checks = [
  "Qui a payé ce mois-ci ?",
  "Qui reste en retard ?",
  "Quelle preuve existe ?",
]

const realities = [
  "Cash, Mobile Money ou virement",
  "Relances plus calmes",
  "Preuves faciles à retrouver",
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7ed] text-[#24160f]">
      <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-[#f59e0b]/20 blur-3xl" />
      <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-[#16a34a]/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#166534] text-lg font-bold text-white shadow-sm">
              R
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#166534]">
              Ranti
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-[#166534]/20 bg-white/70 px-4 py-2 text-sm font-semibold text-[#166534] shadow-sm transition hover:bg-white"
          >
            Se connecter
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
          <div className="space-y-8">
            <div className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#166534] shadow-sm ring-1 ring-[#166534]/10">
              Pour propriétaires africains de 1 à 20 logements
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                Suivez vos loyers sans perdre la relation avec vos locataires.
              </h1>
              <p className="max-w-2xl text-xl leading-9 text-[#6f4b2f]">
                Ranti vous montre qui a payé, qui reste dû et quelle preuve existe, avant toute relance.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:max-w-xl sm:flex-row">
              <Link
                href="/signup"
                className="rounded-2xl bg-[#166534] px-6 py-4 text-center text-base font-bold text-white shadow-lg shadow-[#166534]/20 transition hover:bg-[#14532d]"
              >
                Ouvrir mon espace propriétaire
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-[#d6a35c]/50 bg-white/70 px-6 py-4 text-center text-base font-bold text-[#7c4a16] shadow-sm transition hover:bg-white"
              >
                J’ai déjà un espace
              </Link>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              {realities.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-[#6f4b2f] shadow-sm ring-1 ring-[#d6a35c]/20"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-[#166534] p-4 shadow-2xl shadow-[#166534]/25">
            <div className="rounded-[1.5rem] bg-[#fffaf2] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#9a6a2f]">Vue du mois</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#24160f]">Loyers de juin</h2>
                </div>
                <div className="rounded-full bg-[#dcfce7] px-3 py-1 text-sm font-bold text-[#166534]">
                  3 à suivre
                </div>
              </div>

              <div className="space-y-3">
                {rentRows.map((row) => (
                  <div
                    key={row.name}
                    className="rounded-2xl border border-[#efd8b8] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#24160f]">{row.name}</p>
                        <p className="mt-1 text-sm text-[#8a684d]">{row.unit}</p>
                      </div>
                      <span className="rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-bold text-[#92400e]">
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-4 rounded-xl bg-[#f7ead8] px-3 py-2 text-sm font-semibold text-[#7c4a16]">
                      {row.proof}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-12 md:grid-cols-3">
          {checks.map((item) => (
            <div
              key={item}
              className="rounded-3xl bg-white/75 p-6 shadow-sm ring-1 ring-[#d6a35c]/20"
            >
              <p className="text-lg font-bold leading-7 text-[#24160f]">{item}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
