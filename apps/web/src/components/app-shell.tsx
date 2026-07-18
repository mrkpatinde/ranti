"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, Menu, X } from "lucide-react"
import type { Landlord } from "@/lib/landlords"
import { RantiLogo } from "@/components/ranti-logo"
import { AccountMenu } from "@/components/account-menu"
import { ResumeOnboarding } from "@/components/resume-onboarding"
import { HelpCenter } from "@/components/help-center"

// Nav aplatie autour du bail (clé de voûte). « Baux » ouvre l'arbre
// Lieu → Logement → Locataire/bail (hub = /properties). Les quittances sont
// accessibles depuis chaque bail dans l'arbre, plus en entrée globale.
const MAIN_NAV = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/collections", label: "Encaissements" },
  { href: "/reminders", label: "Relances" },
  { href: "/properties", label: "Baux" },
]

// Routes de l'arbre « Baux » : la tuile Baux reste active sur tout le drill-down.
const BAUX_TREE_PREFIXES = ["/properties", "/units", "/tenants", "/leases", "/receipts"]

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  if (href === "/properties") {
    return BAUX_TREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase().trim() || "R"
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = isActive(pathname, href)

  return (
    <Link
      href={href}
      className={
        active
          ? "block rounded-lg bg-primary px-3.5 py-3 text-sm font-medium text-primary-foreground"
          : "block rounded-lg px-3.5 py-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
      }
    >
      {label}
    </Link>
  )
}

// Menu de navigation mobile : rangé dans un bouton à droite (ADR : nav qui
// débordait en bande horizontale → repliée). Ouvre au tap, ferme au clic
// extérieur, à Échap, ou en suivant un lien.
function MobileNavMenu({ pathname, resumable }: { pathname: string; resumable: boolean }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
      >
        {open ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
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
          <div className="absolute right-0 z-20 mt-2 w-60 space-y-1 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-sm">
            {resumable && <ResumeOnboarding onNavigate={() => setOpen(false)} />}
            <div className="space-y-1" onClick={() => setOpen(false)}>
              {MAIN_NAV.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
              ))}
            </div>
            <div className="space-y-1 border-t border-border pt-1.5">
              <p className="px-3.5 pb-0.5 text-[11px] font-medium text-muted-foreground">Aide</p>
              <HelpCenter />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export function AppShell({ children, landlord }: { children: React.ReactNode; landlord: Landlord | null }) {
  const pathname = usePathname()
  const router = useRouter()

  function goBack() {
    // Retour à la page précédente (comme le bouton natif) ; repli sur l'accueil
    // si on a atterri directement sur une page profonde (lien partagé, reload).
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push("/dashboard")
  }
  const hideShell = pathname.startsWith("/onboarding") || pathname.startsWith("/auth") || !landlord

  if (hideShell) return <>{children}</>

  const ownerName = `${landlord.first_name} ${landlord.last_name}`
  const resumable = landlord.onboarding_status === "exploring"

  return (
    <div className="min-h-screen bg-background text-foreground [font-variant-numeric:tabular-nums] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-screen border-r border-border bg-card px-4 py-5 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2 pb-5">
          <RantiLogo size={36} />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">Ranti</p>
            <p className="text-xs text-muted-foreground">Registre de loyer</p>
          </div>
        </Link>

        <nav className="space-y-1 border-t border-border pt-5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
          ))}
        </nav>

        <div className="mt-auto space-y-2 border-t border-border pt-4">
          {resumable && <ResumeOnboarding />}
          <div className="space-y-1">
            <p className="px-3.5 pb-1 text-[11px] font-medium text-muted-foreground">Aide</p>
            <HelpCenter />
          </div>
          <NavLink href="/settings/profile" label="Paramètres" pathname={pathname} />
          <div className="px-3.5 py-2">
            <p className="truncate text-sm font-medium">{ownerName}</p>
            <p className="text-xs text-muted-foreground">Propriétaire</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full rounded-lg px-3.5 py-3 text-left text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground">
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {pathname !== "/dashboard" ? (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Revenir en arrière"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
                >
                  <ChevronLeft size={18} strokeWidth={1.8} />
                </button>
              ) : null}
              <Link href="/dashboard" className="font-display text-lg font-extrabold tracking-tight">Ranti</Link>
            </div>
            <div className="flex items-center gap-2">
              <MobileNavMenu pathname={pathname} resumable={resumable} />
              <AccountMenu initials={initialsOf(landlord.first_name, landlord.last_name)} ownerName={ownerName} />
            </div>
          </div>
        </header>

        <div className="mx-auto min-h-screen w-full max-w-5xl">
          {children}
        </div>
      </div>
    </div>
  )
}
