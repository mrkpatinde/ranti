"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Landlord } from "@/lib/landlords"

const MAIN_NAV = [
  { href: "/dashboard", label: "Accueil", helper: "Vue d'ensemble" },
  { href: "/collections", label: "Encaissements", helper: "Paiements reçus" },
  { href: "/receipts", label: "Quittances", helper: "Documents" },
  { href: "/properties", label: "Lieux", helper: "Maisons et cours" },
  { href: "/units", label: "Logements", helper: "Chambres et boutiques" },
  { href: "/tenants", label: "Locataires", helper: "Contacts" },
  { href: "/leases", label: "Baux", helper: "Accords" },
]

const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profil" },
]

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ href, label, helper, pathname }: { href: string; label: string; helper?: string; pathname: string }) {
  const active = isActive(pathname, href)

  return (
    <Link
      href={href}
      className={
        active
          ? "block rounded-2xl border border-neutral-950 bg-neutral-950 px-4 py-3 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950"
          : "block rounded-2xl border border-transparent px-4 py-3 text-neutral-700 transition hover:border-neutral-200 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:border-neutral-800 dark:hover:bg-neutral-950"
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      {helper ? <span className={active ? "mt-0.5 block text-xs text-neutral-300 dark:text-neutral-700" : "mt-0.5 block text-xs text-neutral-400"}>{helper}</span> : null}
    </Link>
  )
}

export function AppShell({ children, landlord }: { children: React.ReactNode; landlord: Landlord | null }) {
  const pathname = usePathname()
  const hideShell = pathname.startsWith("/onboarding") || pathname.startsWith("/auth") || !landlord

  if (hideShell) return <>{children}</>

  const ownerName = `${landlord.first_name} ${landlord.last_name}`

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="hidden min-h-screen border-r border-neutral-200 bg-white px-5 py-6 dark:border-neutral-800 dark:bg-neutral-950 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-neutral-200 pb-6 dark:border-neutral-800">
          <span className="flex h-10 w-10 flex-col justify-center gap-[3px] rounded-xl bg-neutral-950 px-2.5 dark:bg-neutral-50">
            <span className="h-[3px] w-5 rounded-full bg-white dark:bg-neutral-950" />
            <span className="h-[3px] w-4 rounded-full bg-white dark:bg-neutral-950" />
            <span className="h-[3px] w-3 rounded-full bg-white dark:bg-neutral-950" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Ranti</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Registre de loyer</p>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} helper={item.helper} pathname={pathname} />
          ))}
        </nav>

        <div className="mt-auto border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <p className="px-4 text-xs uppercase tracking-[0.18em] text-neutral-400">Paramètres</p>
          <div className="mt-2 space-y-1">
            {SETTINGS_NAV.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <p className="text-sm font-medium">{ownerName}</p>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Propriétaire</p>
          </div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button type="submit" className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:border-neutral-950 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-50">
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
            {MAIN_NAV.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "shrink-0 rounded-xl bg-neutral-950 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950"
                      : "shrink-0 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-200"
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
