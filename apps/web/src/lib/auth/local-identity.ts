import { headers } from "next/headers"

// Identité d'auth locale — SOURCE UNIQUE, consommée par lib/auth/server.ts
// (les claims vus par l'app) et lib/supabase/server.ts (le JWT forgé pour la
// base). Les deux DOIVENT désigner le même sujet : sinon l'app croit être un
// bailleur pendant que la base en voit un autre, et la RLS rend des lignes qui
// ne correspondent pas à l'écran.
//
// ── Pourquoi un en-tête plutôt qu'une variable d'environnement ──────────────
// RANTI_LOCAL_AUTH_USER_ID est global au serveur : tous les tests d'une suite
// Playwright partagent alors le MÊME bailleur. Une spec qui crée un profil
// casse celles qui exigent un utilisateur sans profil (constaté le
// 2026-07-27). L'en-tête est par REQUÊTE : chaque spec déclare son bailleur
// via `extraHTTPHeaders`, sans serveur de dev supplémentaire.
//
// ── Sûreté ─────────────────────────────────────────────────────────────────
// Même double garde que le reste du mode local : NODE_ENV ≠ production ET
// flag RANTI_LOCAL_AUTH. En production, cet en-tête est lu par personne — la
// fonction sort avant. Un attaquant qui le poserait n'obtient rien.
// L'en-tête n'est honoré que s'il porte un UUID : une valeur arbitraire est
// ignorée au profit du défaut, jamais injectée telle quelle dans un JWT.

export const LOCAL_AUTH_USER_HEADER = "x-ranti-local-auth-user"

const DEFAULT_LOCAL_AUTH_USER_ID = "00000000-0000-4000-8000-000000000001"
const DEFAULT_LOCAL_AUTH_PHONE = "+22900000000"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Accepte "true" et "1" (la doc utilise RANTI_LOCAL_AUTH=1).
// Jamais actif en production, quelle que soit la valeur.
export function isLocalAuthEnabled(): boolean {
  const flag = process.env.RANTI_LOCAL_AUTH
  return process.env.NODE_ENV !== "production" && (flag === "true" || flag === "1")
}

// Sujet effectif : en-tête (si mode local ET UUID valide), sinon la variable
// d'environnement, sinon le défaut. Lecture d'en-tête tolérante : hors
// contexte de requête, `headers()` lève — on retombe alors sur le défaut au
// lieu de casser le rendu.
export async function resolveLocalAuthUserId(): Promise<string> {
  const fallback = process.env.RANTI_LOCAL_AUTH_USER_ID ?? DEFAULT_LOCAL_AUTH_USER_ID
  if (!isLocalAuthEnabled()) return fallback

  try {
    const requested = (await headers()).get(LOCAL_AUTH_USER_HEADER)?.trim()
    if (requested && UUID_RE.test(requested)) return requested
  } catch {
    // Pas de contexte de requête (rendu statique, tâche hors requête).
  }

  return fallback
}

export function localAuthPhone(): string {
  return process.env.RANTI_LOCAL_AUTH_PHONE ?? DEFAULT_LOCAL_AUTH_PHONE
}
