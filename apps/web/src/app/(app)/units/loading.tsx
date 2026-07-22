// Squelette au gabarit EXACT des écrans liste (max-w-3xl, mêmes paddings) :
// évite le saut de colonne étroite → large du squelette global calqué sur
// l'accueil. Généré avec les mêmes tokens que loading.tsx (rien qui clignote).
export default function Loading() {
  return (
    <main
      aria-busy
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14"
    >
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-muted motion-reduce:animate-none lg:h-10" />
          <div className="h-4 max-w-xl animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>

        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        </div>
      </section>
      <p className="sr-only">Chargement…</p>
    </main>
  )
}
