// Silhouette au gabarit exact de la clôture (max-w-4xl, px-4 sm:px-6) : titre,
// sélecteur de mois, chiffre du mois, tableau.
export default function Loading() {
  return (
    <main aria-busy className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-11 w-56 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      </div>
      <div className="mt-6 space-y-4">
        <div className="h-[86px] animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
      </div>
      <p className="sr-only">Chargement…</p>
    </main>
  )
}
