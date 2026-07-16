import Link from "next/link"
import { notFound } from "next/navigation"
import { ConfirmArchiveButton } from "@/components/confirm-archive-button"
import { requireLandlordProfile } from "@/lib/landlords"
import { archiveTenant, getTenant } from "@/lib/tenants"

type TenantDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string; error?: string }>
}

const noticeLabels: Record<string, string> = {
  tenant_updated: "Locataire mis à jour.",
}

export default async function TenantDetailPage({ params, searchParams }: TenantDetailPageProps) {
  const landlord = await requireLandlordProfile()
  const { id } = await params
  const sp = await searchParams
  const tenant = await getTenant(landlord.id, id)

  if (!tenant) notFound()

  const notice = sp?.notice ? noticeLabels[sp.notice] : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8 lg:py-14">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mt-2 text-sm text-muted-foreground">Détail du locataire</p>
        </div>
        <Link href="/tenants" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline">Vos locataires</Link>
      </header>

      <section className="flex flex-1 flex-col gap-8 py-12">
        {notice ? <p className="rounded-2xl border border-primary/15 bg-secondary px-5 py-4 text-sm text-foreground">{notice}</p> : null}
        {sp?.error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">{sp.error}</p> : null}

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground sm:text-4xl">{tenant.first_name} {tenant.last_name}</h1>
          <p className="max-w-xl text-base leading-7 text-foreground/70">Ranti utilisera ce numéro pour les rappels et relances de loyer.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Téléphone</p>
            <p className="mt-3 text-lg font-medium text-foreground">{tenant.phone}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="mt-3 text-lg font-medium text-foreground">{tenant.email ?? "Non renseigné"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Note</p>
          <p className="mt-3 text-base leading-7 text-foreground/70">{tenant.notes ?? "Aucune note pour ce locataire."}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/tenants/${tenant.id}/edit`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">Modifier ce locataire</Link>
        </div>

        <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm leading-6 text-foreground/80">
            ⓘ Archiver retire le locataire de vos listes, <strong>sans rien effacer</strong> :
            ses baux passés, paiements et quittances restent conservés dans le registre — c&apos;est votre preuve en cas de litige.
            Un locataire avec un bail actif ne peut pas être archivé : terminez d&apos;abord le bail.
          </p>
          <ConfirmArchiveButton
            id={tenant.id}
            action={archiveTenant}
            label="Archiver ce locataire"
            confirmMessage="Archiver ce locataire ? Il quitte vos listes ; ses baux, paiements et quittances restent conservés dans le registre."
          />
        </div>
      </section>
    </main>
  )
}
