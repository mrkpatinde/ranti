import Link from "next/link"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-6 py-12 text-black">
      {/* Hero Section */}
      <section className="space-y-10">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black">
            Vos loyers, sans confusion.
          </h1>
          <p className="text-lg leading-8 text-neutral-700">
            Ranti aide les propriétaires à voir qui a payé, qui est en retard, et quelle preuve existe avant toute relance.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="#beta"
            className="block w-full rounded-xl bg-black px-4 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800"
          >
            Demander un accès
          </Link>
          <Link
            href="#comment-ca-marche"
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-base font-medium text-black transition hover:border-black"
          >
            Voir comment ça marche
          </Link>
        </div>

        <div className="text-center text-sm text-neutral-500">
          <p>Pensé pour les propriétaires qui gèrent leurs loyers</p>
          <p>avec WhatsApp, un cahier, Excel, des appels ou des captures Mobile Money.</p>
        </div>
      </section>

      {/* Situations fréquentes */}
      <section className="mt-16 space-y-6">
        <h2 className="text-2xl font-semibold text-black">Situations fréquentes</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Un locataire dit avoir payé, mais la preuve est difficile à retrouver.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Le propriétaire oublie qui doit être relancé.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Les reçus sont faits à la main ou envoyés trop tard.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Les paiements cash, Mobile Money et virements sont dispersés.</p>
          </div>
        </div>
      </section>

      {/* Pour qui ? */}
      <section className="mt-16 space-y-6">
        <h2 className="text-2xl font-semibold text-black">Pour qui ?</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Propriétaires de 1 à 20 logements</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Petits gestionnaires immobiliers</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Propriétaires qui suivent les loyers avec WhatsApp, cahier ou Excel</p>
          </div>
        </div>
      </section>

      {/* Ce que Ranti permet de faire */}
      <section className="mt-16 space-y-6">
        <h2 className="text-2xl font-semibold text-black">Ce que Ranti permet de faire</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Suivre les loyers attendus</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Marquer un paiement comme reçu</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Voir les retards</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Attacher une preuve</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Générer une quittance simple</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Préparer une relance WhatsApp propre</p>
          </div>
        </div>
      </section>

      {/* Carte d'interface produit réaliste */}
      <section className="mt-16 space-y-6">
        <h2 className="text-2xl font-semibold text-black">À quoi ça ressemble</h2>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6">
          {/* En-tête de la carte */}
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-4">
            <h3 className="font-medium text-black">Loyers - Juin 2025</h3>
            <span className="text-sm text-neutral-500">3/5 payés</span>
          </div>
          
          {/* Liste des locataires */}
          <div className="space-y-4">
            {/* Locataire 1 - Payé */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                  <span className="text-sm font-medium">AK</span>
                </div>
                <div>
                  <p className="font-medium text-black">Adama Koné</p>
                  <p className="text-sm text-neutral-500">Appartement B1</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-black">75 000 FCFA</p>
                <p className="text-sm text-green-600">Payé</p>
                <p className="text-xs text-neutral-500">Mobile Money</p>
                <p className="text-xs text-neutral-400">Capture jointe</p>
              </div>
            </div>

            {/* Locataire 2 - En retard */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                  <span className="text-sm font-medium">FD</span>
                </div>
                <div>
                  <p className="font-medium text-black">Fatou Diallo</p>
                  <p className="text-sm text-neutral-500">Studio C2</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-black">60 000 FCFA</p>
                <p className="text-sm text-red-600">-2 jours</p>
                <p className="text-xs text-neutral-500">Virement</p>
                <p className="text-xs text-neutral-400">À vérifier</p>
              </div>
            </div>

            {/* Locataire 3 - Payé */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                  <span className="text-sm font-medium">YT</span>
                </div>
                <div>
                  <p className="font-medium text-black">Yacouba Touré</p>
                  <p className="text-sm text-neutral-500">Maison D1</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-black">100 000 FCFA</p>
                <p className="text-sm text-green-600">Payé</p>
                <p className="text-xs text-neutral-500">Cash</p>
                <p className="text-xs text-neutral-400">Reçu généré</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200">
            <button className="flex-1 rounded-lg bg-black text-white py-2 text-sm font-medium">
              Confirmer
            </button>
            <button className="flex-1 rounded-lg border border-neutral-300 text-black py-2 text-sm font-medium">
              Relancer
            </button>
            <button className="flex-1 rounded-lg border border-neutral-300 text-black py-2 text-sm font-medium">
              Générer reçu
            </button>
          </div>
        </div>
      </section>

      {/* Bêta privée */}
      <section id="beta" className="mt-16 space-y-6">
        <h2 className="text-2xl font-semibold text-black">Ranti ouvre bientôt en bêta privée.</h2>
        <p className="text-neutral-700 leading-relaxed">
          Les premiers propriétaires pourront tester une version simple pour suivre leurs loyers, retards, preuves et quittances.
        </p>
        <div className="space-y-3">
          <Link
            href="#beta"
            className="block w-full rounded-xl bg-black px-4 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800"
          >
            Demander un accès
          </Link>
        </div>
      </section>

      {/* Section comment ça marche (ancrage) */}
      <section id="comment-ca-marche" className="mt-16 space-y-6">
        <h2 className="text-2xl font-semibold text-black">Comment ça marche ?</h2>
        <p className="text-neutral-700 leading-relaxed">
          Ranti est conçu pour être simple et direct. Vous ajoutez vos logements et locataires, puis vous suivez les paiements au fur et à mesure. Chaque paiement peut être marqué avec sa preuve, et vous voyez immédiatement qui est à jour et qui est en retard.
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-neutral-200 text-center text-sm text-neutral-500">
        <p>Ranti - Le cahier de loyers moderne des propriétaires africains</p>
      </footer>
    </main>
  )
}
