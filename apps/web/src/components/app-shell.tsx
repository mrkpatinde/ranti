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
          ? "block rounded-xl bg-neutral-950 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950"
          : "block rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
      }
    >
      {label}
    </Link>
  )
}

function NavSection({ title, items, pathname }: { title: string; items: Array<{ href: string; label: string }>; pathname: string }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">{title}</p>
      {items.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
      ))}
    </div>
  )
}

export function AppShell({ children, landlord }: { children: React.ReactNode; landlord: Landlord | null }) {
  const pathname = usePathname()
  const hideShell = pathname.startsWith("/onboarding") || pathname.startsWith("/auth") || !landlord

  if (hideShell) return <>{children}</>

  const ownerName = `${landlord.first_name} ${landlord.last_name}`

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-screen border-r border-neutral-200 bg-white px-4 py-5 dark:border-neutral-800 dark:bg-neutral-950 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2 pb-5">
          <span className="flex h-9 w-9 flex-col justify-center gap-[3px] rounded-xl bg-neutral-950 px-2.5 dark:bg-neutral-50">
            <span className="h-[3px] w-5 rounded-full bg-white dark:bg-neutral-950" />
            <span className="h-[3px] w-4 rounded-full bg-white dark:bg-neutral-950" />
            <span className="h-[3px] w-3 rounded-full bg-white dark:bg-neutral-950" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Ranti</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Registre de loyer</p>
          </div>
        </Link>

        <nav className="space-y-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <NavSection title="Suivi" items={TRACKING_NAV} pathname={pathname} />
          <NavSection title="Registre" items={REGISTER_NAV} pathname={pathname} />
        </nav>

        <div className="mt-auto space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <NavLink href="/settings/profile" label="Profil" pathname={pathname} />
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{ownerName}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Propriétaire</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-50">
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="font-semibold tracking-tight">Ranti</Link>
            <Link href="/settings/profile" className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700">
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
                      ? "shrink-0 rounded-xl bg-neutral-950 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950"
                      : "shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300"
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <div className="mx-auto min-h-screen w-full max-w-5xl bg-white dark:bg-neutral-950 lg:bg-transparent lg:dark:bg-transparent">
          {children}
        </div>
      </div>
    </div>
  )
}
