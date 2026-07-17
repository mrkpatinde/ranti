"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

// Menu profil (mobile) : Paramètres + Se déconnecter, tout de suite accessibles
// depuis l'avatar. Ouvre au tap, ferme au clic extérieur ou Échap (pattern natif).
export function AccountMenu({ initials, ownerName }: { initials: string; ownerName?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profil"
        aria-expanded={open}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground transition hover:brightness-95"
      >
        {initials}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-sm">
            {ownerName ? (
              <div className="px-3 pb-2 pt-1.5">
                <p className="truncate text-sm font-semibold text-foreground">{ownerName}</p>
                <p className="text-xs text-muted-foreground">Propriétaire</p>
              </div>
            ) : null}
            <Link
              href="/settings/profile"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-secondary"
            >
              Paramètres
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  )
}
