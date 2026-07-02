"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Landlord } from "@/lib/landlords"

const TRACKING_NAV = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/collections", label: "Encaissements" },
  { href: "/receipts", label: "Quittances" },
]

const REGISTER_NAV = [
  { href: "/properties", label: "Lieux" },
  { href: "/units", label: "Logements" },
  { href: "/tenants", label: "Locataires" },
  { href: "/leases", label: "Baux" },
]

const MOBILE_NAV = [
  ...TRACKING_NAV,
  ...REGISTER_NAV,
]

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = isActive(pathname, href)

  return (
    <Link
      href={href}
      className={
        active
          ? "block rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
          : "block rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
      }
    >
      {label}
    </Link>
  )
}

function NavSection({ title, items, pathname }: { title: string; items: Array<{ href: string; label: string }>; pathname: string }) {
  return (
    <div className="space-y-1">
      <p className="px-3.5 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      {items.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
      ))}
    </div>
  )
}

// Trois lignes de registre, celle du milieu barrée en orange — la marque Ranti.
function LogoMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 flex-col items-start justify-center gap-[3px] rounded-lg bg-primary px-2.5">
      <span className="h-[2.5px] w-4 rounded-full bg-primary-foreground" />
      <span className="h-[2.5px] w-4 rounded-full bg-accent" />
      <span className="h-[2.5px] w-4 rounded-full bg-primary-foreground" />
    </span>
  )
}

export function AppShell({ children, landlord }: { children: React.ReactNode; landlord: Landlord | null }) {
  const pathname = usePathname()
  const hideShell = pathname.startsWith("/onboarding") || pathname.startsWith("/auth") || !landlord

  if (hideShell) return <>{children}</>

  const ownerName = `${landlord.first_name} ${landlord.last_name}`

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-screen border-r border-border bg-card px-4 py-5 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2 pb-5">
          <LogoMark />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">Ranti</p>
            <p className="text-xs text-muted-foreground">Registre de loyer</p>
          </div>
        </Link>

        <nav className="space-y-6 border-t border-border pt-5">
          <NavSection title="Suivi" items={TRACKING_NAV} pathname={pathname} />
          <NavSection title="Registre" items={REGISTER_NAV} pathname={pathname} />
        </nav>

        <div className="mt-auto space-y-2 border-t border-border pt-4">
          <NavLink href="/settings/profile" label="Profil" pathname={pathname} />
          <div className="px-3.5 py-2">
            <p className="truncate text-sm font-medium">{ownerName}</p>
            <p className="text-xs text-muted-foreground">Propriétaire</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full rounded-full px-3.5 py-2 text-left text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground">
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="font-display text-lg font-extrabold tracking-tight">Ranti</Link>
            <Link href="/settings/profile" className="rounded-full border border-border px-3.5 py-2 text-sm font-medium">
              Profil
            </Link>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {MOBILE_NAV.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "shrink-0 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
                      : "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70"
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <div className="mx-auto min-h-screen w-full max-w-5xl">
          {children}
        </div>
      </div>
    </div>
  )
}
