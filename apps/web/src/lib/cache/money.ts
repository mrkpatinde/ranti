import { revalidatePath } from "next/cache"

// Surfaces qui LISENT un mouvement d'argent. Avec le cache client (staleTimes
// 30 s), toute écriture d'argent doit purger l'ENSEMBLE du flux, sinon un écran
// affiche des chiffres périmés jusqu'à 30 s. Next 16 rafraîchit encore toutes
// les pages visitées après une server action, mais la doc annonce que ce
// comportement sera restreint au chemin exact ; ce helper central garantit
// qu'aucune surface n'est oubliée le jour où la restriction s'applique.
//
// "/(app)/leases/[id]" + type "page" : purge toutes les instances du segment
// dynamique (fiches bail). Passer { leaseId } ajoute aussi le chemin littéral
// pour cibler la fiche concernée.
//
// NON-"use server" (fonction synchrone) : ce module est importé par les
// server actions, pas exposé comme action lui-même.
export function revalidateMoneySurfaces(opts?: { leaseId?: string }) {
  revalidatePath("/dashboard")
  revalidatePath("/collections")
  revalidatePath("/receipts")
  revalidatePath("/reminders")
  revalidatePath("/journal")
  revalidatePath("/leases")
  revalidatePath("/(app)/leases/[id]", "page")
  if (opts?.leaseId) revalidatePath(`/leases/${opts.leaseId}`)
}
