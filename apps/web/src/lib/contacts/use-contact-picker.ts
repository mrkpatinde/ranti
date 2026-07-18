"use client"

import { useCallback, useSyncExternalStore } from "react"

// Contact Picker API (Chrome/Edge Android uniquement) : le proprietaire choisit
// le locataire dans ses contacts, on preremplit nom + telephone. Amelioration
// progressive, jamais bloquante : le bouton n'apparait que si l'API existe,
// partout ailleurs la saisie manuelle reste inchangee. Aucune permission
// persistante : le navigateur n'expose que le contact explicitement choisi.

type ContactInfo = { name?: string[]; tel?: string[] }
type ContactsManager = {
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<ContactInfo[]>
}

export type PickedContact = {
  firstName: string
  lastName: string
  phone: string
}

// Nettoyage leger avant preremplissage : separateurs retires, prefixe
// international 00229 ramene a +229. La validation finale reste
// normalizeTenantPhone (format Benin) a la soumission ; le champ reste
// editable pour correction.
function cleanPhone(raw: string): string {
  let p = raw.replace(/[\s().\-]/g, "")
  if (p.startsWith("00229")) p = `+229${p.slice(5)}`
  return p
}

// « Awa Simon » -> prenom « Awa », nom « Simon » ; un seul mot -> prenom seul.
function splitName(display: string): { firstName: string; lastName: string } {
  const parts = display.trim().split(/\s+/)
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

// Capacite navigateur statique : jamais de notification, snapshot serveur false
// (le bouton n'apparait qu'apres hydratation, aucun decalage SSR).
const subscribeNever = () => () => {}
const clientSnapshot = () => "contacts" in navigator
const serverSnapshot = () => false

export function useContactPicker(): {
  supported: boolean
  pick: () => Promise<PickedContact | null>
} {
  const supported = useSyncExternalStore(subscribeNever, clientSnapshot, serverSnapshot)

  const pick = useCallback(async (): Promise<PickedContact | null> => {
    const contacts = (navigator as Navigator & { contacts?: ContactsManager }).contacts
    if (!contacts) return null
    try {
      const [contact] = await contacts.select(["name", "tel"], { multiple: false })
      if (!contact) return null
      const { firstName, lastName } = splitName(contact.name?.[0] ?? "")
      const phone = contact.tel?.[0] ? cleanPhone(contact.tel[0]) : ""
      if (!firstName && !phone) return null
      return { firstName, lastName, phone }
    } catch {
      // Annulation, geste utilisateur manquant ou selecteur deja ouvert :
      // on retombe silencieusement sur la saisie manuelle.
      return null
    }
  }, [])

  return { supported, pick }
}
