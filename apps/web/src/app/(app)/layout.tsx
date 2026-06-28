import { AppShell } from "@/components/app-shell"
import { requireAuth } from "@/lib/auth"
import { getCurrentLandlord } from "@/lib/landlords"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()
  const landlord = await getCurrentLandlord()

  return <AppShell landlord={landlord}>{children}</AppShell>
}
