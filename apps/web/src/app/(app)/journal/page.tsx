import { redirect } from "next/navigation"

// Le journal est devenu l'accueil unifié (ADR-014). Cette route historique
// redirige proprement vers /dashboard. Pas de boucle : /dashboard ne renvoie
// jamais vers /journal.
export default function JournalPage() {
  redirect("/dashboard")
}
