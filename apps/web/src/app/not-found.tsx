import Link from "next/link"
import { RantiLogo } from "@/components/ranti-logo"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <RantiLogo size={28} />
          <span className="font-display text-lg font-extrabold tracking-tight text-foreground">Ranti</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
          Page introuvable
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Cette page n&apos;existe pas ou n&apos;est plus disponible. Vérifiez le lien reçu,
          ou revenez à l&apos;accueil.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
        >
          Revenir à l&apos;accueil
        </Link>
      </div>
    </main>
  )
}
