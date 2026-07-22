"use client"

// Chiffre héro du dashboard (référence Moneco, 2026-07-22) : un seul montant
// dominant « Reste à encaisser », puce période, et toggle œil pour masquer le
// solde (utile sur le terrain, appareil partagé). La préférence vit en
// localStorage, lue via useSyncExternalStore : pas de désync SSR (snapshot
// serveur = affiché) et mise à jour même onglet. Le montant est calculé côté
// serveur et passé en prop ; ce composant ne porte que l'affichage.
import { useSyncExternalStore } from "react"
import { Eye, EyeOff } from "lucide-react"
import { formatFcfaNumber } from "@/lib/format"

const HIDE_KEY = "ranti:hide-balance"
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

function isHidden() {
  return localStorage.getItem(HIDE_KEY) === "1"
}

function setHiddenPref(next: boolean) {
  localStorage.setItem(HIDE_KEY, next ? "1" : "0")
  listeners.forEach((l) => l())
}

export function HeroBalance({
  amount,
  period,
  label,
}: {
  amount: number
  period: string
  label: string
}) {
  // Snapshot serveur = false : le solde est visible par défaut, masqué au 1er
  // paint client seulement si l'utilisateur l'avait choisi.
  const hidden = useSyncExternalStore(subscribe, isHidden, () => false)

  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-6 shadow-[0_14px_50px_-18px_rgba(41,41,41,0.22)] lg:px-8 lg:py-8">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground/70">
          {period}
        </span>
        <button
          type="button"
          onClick={() => setHiddenPref(!hidden)}
          aria-label={hidden ? "Afficher le montant" : "Masquer le montant"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
        >
          {hidden ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
        </button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-ink-title lg:text-5xl">
        {hidden ? "••• •••" : formatFcfaNumber(amount)}
        <span className="ml-2 text-lg font-semibold text-muted-foreground lg:text-2xl">FCFA</span>
      </p>
    </div>
  )
}
