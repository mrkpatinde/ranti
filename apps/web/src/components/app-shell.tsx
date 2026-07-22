"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Building2, ChevronLeft, HandCoins, Home, MessageCircle, type LucideIcon } from "lucide-react"
import type { Landlord } from "@/lib/landlords"
import { RantiLogo } from "@/components/ranti-logo"
import { ResumeOnboarding } from "@/components/resume-onboarding"
import { HelpCenter } from "@/components/help-center"

// Nav aplatie autour du bail (clé de voûte). « Baux » ouvre l'arbre
// Lieu → Logement → Locataire/bail (hub = /properties). Les quittances sont
// accessibles depuis chaque bail dans l'arbre, plus en entrée globale.
const MAIN_NAV = [
  { href: "/dashboard", label: "Accueil", Icon: Home },
  { href: "/collections", label: "Encaissements", Icon: HandCoins },
  { href: "/reminders", label: "Relances", Icon: MessageCircle },
  { href: "/properties", label: "Baux", Icon: Building2 },
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

// Lien de nav du menu desktop (sidebar) : pastille encre quand actif.
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

// Onglet de la barre du bas (mobile, référence Moneco) : icône + label, encre
// quand actif, muted sinon. Remplace l'ancien menu hamburger.
function BottomTab({
  href,
  label,
  Icon,
  pathname,
}: {
  href: string
  label: string
  Icon: LucideIcon
  pathname: string
}) {
  const active = isActive(pathname, href)

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon size={22} strokeWidth={active ? 2 : 1.8} />
      <span className="max-w-full truncate text-[11px] font-medium leading-none">{label}</span>
    </Link>
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
  const initials = initialsOf(landlord.first_name, landlord.last_name)
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
        {/* Top row mobile minimal (référence Moneco) : retour + marque à gauche,
            compte (avatar → Paramètres) et journal (cloche → activité) à droite.
            La nav principale vit désormais dans la barre d'onglets du bas. */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {pathname !== "/dashboard" ? (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Revenir en arrière"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
                >
                  <ChevronLeft size={18} strokeWidth={1.8} />
                </button>
              ) : null}
              <Link href="/dashboard" className="font-display text-lg font-extrabold tracking-tight">Ranti</Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/journal"
                aria-label="Journal d'activité"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
              >
                <Bell size={18} strokeWidth={1.8} />
              </Link>
              <Link
                href="/settings/profile"
                aria-label="Paramètres"
                title={ownerName}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground"
              >
                {initials}
              </Link>
            </div>
          </div>
        </header>

        {/* pb pour ne pas masquer le dernier élément derrière la barre du bas. */}
        <div className="mx-auto min-h-screen w-full max-w-5xl pb-24 lg:pb-0">
          {children}
        </div>
      </div>

      {/* Barre d'onglets fixe (mobile) : 4 destinations, façon wallet. */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MAIN_NAV.map((item) => (
          <BottomTab
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.Icon}
            pathname={pathname}
          />
        ))}
      </nav>
    </div>
  )
}
