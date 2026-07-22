// Squelette au gabarit EXACT des écrans formulaire (max-w-md) : sans lui, la
// sous-route hériterait du squelette LARGE de son segment parent et l'écran
// sauterait de large à étroit à l'arrivée du contenu.
export default function Loading() {
  return (
    <main
      aria-busy
      className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 lg:py-14"
    >
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div className="mt-2 h-4 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </header>

      <section className="flex flex-1 flex-col gap-6 py-12">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="space-y-4">
          <div className="h-14 animate-pulse rounded-xl border border-border bg-card motion-reduce:animate-none" />
          <div className="h-14 animate-pulse rounded-xl border border-border bg-card motion-reduce:animate-none" />
          <div className="h-14 animate-pulse rounded-xl border border-border bg-card motion-reduce:animate-none" />
        </div>
        <div className="h-12 w-40 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      </section>
      <p className="sr-only">Chargement…</p>
    </main>
  )
}
