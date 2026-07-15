"use client"

import { useState } from "react"
import Link from "next/link"

// Menu compte du dashboard (ADR-020) : Mon compte · Gérer les baux ·
// Se déconnecter. Ouvert au tap (pattern natif), fermé au clic extérieur.
export function AccountMenu({ initials }: { initials: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu du compte"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-accent transition hover:brightness-95"
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
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-sm">
            <Link
              href="/settings/profile"
              className="block rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-secondary"
            >
              Mon compte
            </Link>
            <Link
              href="/leases"
              className="block rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-secondary"
            >
              Gérer les baux
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="block w-full rounded-xl px-3 py-3 text-left text-sm text-destructive transition hover:bg-destructive/10"
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
