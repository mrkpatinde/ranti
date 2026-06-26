import Link from "next/link"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-6 py-12 text-black">
      <section className="space-y-10">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Ranti
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black">
            Vos loyers, sans confusion.
          </h1>
          <p className="text-lg leading-8 text-neutral-700">
            Avant de relancer un locataire, voyez ce qui est payé, ce qui reste dû et la preuve disponible.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/signup"
            className="block w-full rounded-xl bg-black px-4 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800"
          >
            Ouvrir mon espace propriétaire
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-base font-medium text-black transition hover:border-black"
          >
            Se connecter
          </Link>
        </div>
      </section>
    </main>
  )
}
