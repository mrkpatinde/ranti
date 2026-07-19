// Squelette au gabarit EXACT de la page relances (max-w-3xl, paddings px-4
// sm:px-6) : silhouette du titre, de la carte réglages et des listes, pour
// une nav qui répond au doigt sans saut quand le cadre réel arrive.
export default function Loading() {
  return (
    <main aria-busy className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>

      <div className="mt-6 space-y-6">
        <div className="h-[92px] animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
        </div>
      </div>
      <p className="sr-only">Chargement…</p>
    </main>
  )
}
