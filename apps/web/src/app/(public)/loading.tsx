// État de chargement des pages publiques (verifier, recu, confirmer…) :
// carte squelette centrée, même gabarit que les pages token.
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16" aria-busy>
      <div className="w-full space-y-4 rounded-2xl border border-border bg-card p-8">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      </div>
      <p className="sr-only">Chargement…</p>
    </main>
  )
}
