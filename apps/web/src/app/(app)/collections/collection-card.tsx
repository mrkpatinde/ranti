"use client"

// #167 Phase 4 — carte encaissement optimiste : « Confirmer » et « Annuler »
// basculent la carte INSTANTANÉMENT (badge + actions), sans attendre le
// serveur — le geste le plus fréquent du produit ne doit pas sembler lent sur
// réseau terrain. Si l'action échoue, useOptimistic revient tout seul à
// l'état réel et l'erreur s'affiche sur la carte : rollback visible, jamais
// de fausse confirmation persistante. Succès → la revalidation apporte les
// vraies données (badge définitif, lien du document).
import { useOptimistic, useState } from "react"
import Link from "next/link"
import { SubmitButton } from "@/components/submit-button"
import { badgeClasses, type BadgeVariant } from "@/components/ui/badge"
import { buttonClasses } from "@/components/ui/button"
// Imports ciblés ("use server" / types seuls) : l'index du domaine ré-exporte
// aussi les queries serveur (next/headers), interdites dans un bundle client.
import { cancelCollection, confirmCollection } from "@/lib/collections/actions"
import type { CollectionStatus } from "@/lib/collections/types"
import { generateReceipt } from "@/lib/receipts/actions"

const statusLabels: Record<CollectionStatus, string> = {
  draft: "Brouillon — à confirmer",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

function statusVariant(status: CollectionStatus): BadgeVariant {
  switch (status) {
    case "draft":
      return "accent"
    case "confirmed":
      return "success"
    case "cancelled":
      return "neutral"
  }
}

export type CollectionCardProps = {
  id: string
  status: CollectionStatus
  amountLabel: string
  partiesLine: string
  metaLine: string
  paymentReference: string | null
  note: string | null
  cancellationReason: string | null
  receiptId: string | null
  receiptCancelled: boolean
}

export function CollectionCard({
  id,
  status,
  amountLabel,
  partiesLine,
  metaLine,
  paymentReference,
  note,
  cancellationReason,
  receiptId,
  receiptCancelled,
}: CollectionCardProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<CollectionStatus>(status)
  const [error, setError] = useState<string | null>(null)

  // Les form actions clientes tournent dans une transition : la mise à jour
  // optimiste s'applique tout de suite et se résout d'elle-même — vers les
  // données revalidées en cas de succès, vers l'état réel en cas d'échec.
  async function handleConfirm(formData: FormData) {
    setError(null)
    setOptimisticStatus("confirmed")
    const result = await confirmCollection({ error: null }, formData)
    if (result.error) setError(result.error)
  }

  async function handleCancel(formData: FormData) {
    setError(null)
    setOptimisticStatus("cancelled")
    const result = await cancelCollection({ error: null }, formData)
    if (result.error) setError(result.error)
  }

  // Confirmation optimiste en vol : le serveur n'a pas encore répondu.
  const confirming = optimisticStatus === "confirmed" && status === "draft"
  const cancelling = optimisticStatus === "cancelled" && status !== "cancelled"

  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            {amountLabel}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{partiesLine}</p>
          <p className="mt-1 text-sm text-muted-foreground">{metaLine}</p>
        </div>
        <span className={badgeClasses(statusVariant(optimisticStatus))}>
          {statusLabels[optimisticStatus]}
        </span>
      </div>

      {paymentReference ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Réf. transaction : <span className="font-medium text-foreground">{paymentReference}</span>
        </p>
      ) : null}

      {note ? <p className="mt-3 text-sm text-muted-foreground">{note}</p> : null}

      {status === "cancelled" && cancellationReason ? (
        <p className="mt-3 text-sm text-muted-foreground">Motif : {cancellationReason}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
          Quittance en préparation…
        </p>
      ) : cancelling ? (
        <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
          Annulation en cours…
        </p>
      ) : optimisticStatus === "draft" ? (
        <div className="mt-5 space-y-4">
          <form action={handleConfirm}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60">
              Confirmer
            </SubmitButton>
          </form>

          <form action={handleCancel} className="space-y-2 rounded-2xl border border-border p-4">
            <input type="hidden" name="id" value={id} />
            <label htmlFor={`reason-${id}`} className="block text-sm font-medium text-foreground">
              Motif d&apos;annulation <span className="text-destructive">*</span>
            </label>
            <textarea
              id={`reason-${id}`}
              name="reason"
              rows={2}
              required
              minLength={3}
              placeholder="Ex. paiement saisi par erreur"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
            <SubmitButton className={buttonClasses("destructive-outline")}>
              Annuler cet encaissement
            </SubmitButton>
          </form>
        </div>
      ) : optimisticStatus === "confirmed" ? (
        receiptId ? (
          <Link
            href={`/receipts/${receiptId}`}
            className="mt-5 inline-flex rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary"
          >
            Voir le document
          </Link>
        ) : (
          <div className="mt-5 space-y-4">
            {receiptCancelled ? (
              <p className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-6 text-accent">
                ⓘ Le document de cet encaissement a été <strong>annulé</strong>, mais le paiement reste
                confirmé dans le registre. Générez un document corrigé — ou annulez aussi
                l&apos;encaissement ci-dessous s&apos;il a été saisi par erreur.
              </p>
            ) : null}
            <form action={generateReceipt}>
              <input type="hidden" name="reception_id" value={id} />
              <SubmitButton className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary disabled:opacity-60">
                {receiptCancelled ? "Générer un document corrigé" : "Générer la quittance ou le reçu"}
              </SubmitButton>
            </form>
            <details>
              <summary className="inline-flex cursor-pointer list-none rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground/70 transition hover:border-destructive/40 hover:text-destructive">
                Annuler cet encaissement…
              </summary>
              <form action={handleCancel} className="mt-3 space-y-2 rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
                <input type="hidden" name="id" value={id} />
                <p className="text-sm leading-6 text-destructive">
                  L&apos;annulation remet l&apos;échéance en attente (le loyer redevient dû) et reste tracée
                  dans le registre avec son motif. Elle est impossible tant qu&apos;un document actif existe.
                </p>
                <label htmlFor={`reason-confirmed-${id}`} className="block text-sm font-medium text-destructive">
                  Motif d&apos;annulation <span className="text-destructive">*</span>
                </label>
                <textarea
                  id={`reason-confirmed-${id}`}
                  name="reason"
                  rows={2}
                  required
                  minLength={3}
                  placeholder="Ex. montant saisi par erreur"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                />
                <SubmitButton className={buttonClasses("destructive-outline")}>
                  Annuler cet encaissement
                </SubmitButton>
              </form>
            </details>
          </div>
        )
      ) : null}
    </article>
  )
}
