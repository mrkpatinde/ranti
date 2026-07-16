// État de chargement des écrans app : squelette sobre aux tokens (rien qui
// clignote fort), rendu dans le shell pendant que le server component charge.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md space-y-8 px-6 py-10 lg:max-w-2xl lg:py-16" aria-busy>
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none lg:h-12 lg:w-64" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      </div>
      <p className="sr-only">Chargement…</p>
    </main>
  )
}
