import Link from "next/link"
import { requireLandlordProfile } from "@/lib/landlords"
import { getLandlordTenants } from "@/lib/tenants"

type TenantsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  tenant_created: "Locataire créé.",
  tenant_updated: "Locataire mis à jour.",
  tenant_archived: "Locataire archivé.",
}

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const landlord = await requireLandlordProfile()
  const params = await searchParams
  const tenants = await getLandlordTenants(landlord.id)
  const notice = params?.notice ? noticeLabels[params.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Vos locataires</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">
          Tableau de bord
        </Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">Vos locataires</h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">Ajoutez un locataire joignable, puis créez son bail.</p>
        </div>

        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {params?.error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">{params.error}</p> : null}

        {tenants.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">Aucun locataire pour le moment</h2>
            <p className="mt-2 text-base leading-7 text-foreground/70">Ajoutez votre premier locataire pour pouvoir créer un bail.</p>
            <Link href="/leases/new" className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:brightness-95 lg:w-fit">Créer un bail</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tenants.map((tenant) => (
              <Link key={tenant.id} href={`/tenants/${tenant.id}`} className="block rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
                <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{tenant.first_name} {tenant.last_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{[tenant.phone, tenant.email].filter(Boolean).join(" — ")}</p>
                <span className="mt-5 inline-flex text-sm font-medium text-foreground">Voir le détail</span>
              </Link>
            ))}
            <Link href="/leases/new" className="inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary">Créer un bail</Link>
          </div>
        )}
      </section>
    </main>
  )
}
