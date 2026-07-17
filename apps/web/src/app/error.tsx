"use client" // Les error boundaries doivent être des Client Components

import { useEffect } from "react"
import { RantiLogo } from "@/components/ranti-logo"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <RantiLogo size={28} />
          <span className="font-display text-lg font-extrabold tracking-tight text-foreground">Ranti</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
          Un problème est survenu
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Vos données sont en sécurité dans votre registre. Réessayez — si le
          problème persiste, revenez dans quelques minutes.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
        >
          Réessayer
        </button>
      </div>
    </main>
  )
}
