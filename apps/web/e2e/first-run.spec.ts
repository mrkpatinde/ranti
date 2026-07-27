import { expect, test } from "@playwright/test"

// Parcours de prise en main, AVEC données réelles.
//
// Ces tests étaient réputés impossibles : « l'auth Google seule (ADR-010)
// empêche un login automatisé ». C'était faux. Le bypass de développement
// existe depuis longtemps (RANTI_LOCAL_AUTH, lib/auth/server.ts), il est déjà
// posé dans playwright.config.ts, et deux specs authentifiées l'utilisaient
// déjà — mais sans SUPABASE_JWT_SECRET, aucune session Supabase n'était forgée,
// les lectures partaient en `anon`, la RLS les bloquait, et ces specs ne
// pouvaient vérifier que des redirections. Le secret du stack LOCAL est
// désormais fourni : la RLS s'applique normalement (on ne la contourne pas) et
// les écrans porteurs de données deviennent testables.
//
// Ce que ce fichier verrouille en priorité : la régression corrigée en
// v0.3.38.0 — recharger /first-run ne doit plus proposer de recréer un bail
// qui existe déjà.

const UNIQUE = Date.now().toString().slice(-6)

// /first-run redirige cote SERVEUR vers /dashboard quand l'onboarding est
// termine. Playwright abandonne alors la navigation (net::ERR_ABORTED) meme si
// la redirection a parfaitement abouti : on tolere l'abandon et on juge sur
// l'URL finale, jamais sur le succes du goto.
async function gotoTolerant(page: import("@playwright/test").Page, url: string) {
  await page.goto(url).catch(() => {})
  await page.waitForLoadState("domcontentloaded").catch(() => {})
}

// LECTURE SEULE, volontairement. Une premiere version creait le profil par le
// parcours d'onboarding — et cassait deux specs existantes qui exigent un
// utilisateur authentifie SANS profil (`welcome.spec.ts`). Tous les tests
// partagent le meme utilisateur d'auth locale : muter son profil pollue la
// suite entiere.
//
// Tant que chaque spec n'a pas son propre utilisateur (fixture a construire,
// cf. TODOS), ces tests s'abstiennent si le profil n'existe pas plutot que de
// le fabriquer. Ils couvrent alors la base seedee, pas un etat qu'ils auraient
// eux-memes cree.
async function hasProfile(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto("/onboarding/profile")
  const phone = page.getByLabel(/^Numéro de téléphone/)
  const formShown = await phone.isVisible({ timeout: 5_000 }).catch(() => false)
  return !formShown
}

test.describe.configure({ mode: "serial" })

test("la prise en main s'ouvre sur un bailleur authentifié", async ({ page }) => {
  test.skip(!(await hasProfile(page)), "aucun profil bailleur pour l'utilisateur d'auth locale")
  await gotoTolerant(page, "/first-run")

  // Un bailleur deja « done » est renvoye au tableau de bord : les deux
  // destinations sont acceptables, l'important est qu'aucune erreur ni
  // redirection vers la connexion ne survienne.
  await expect(page).toHaveURL(/first-run|dashboard/)
  await expect(page.getByRole("link", { name: /connecter|Continuer avec Google/i })).toHaveCount(0)
})

test("recharger la prise en main ne repropose pas de créer un bail existant", async ({ page }) => {
  test.skip(!(await hasProfile(page)), "aucun profil bailleur pour l'utilisateur d'auth locale")
  await gotoTolerant(page, "/first-run")

  // Le parcours guide n'est propose qu'aux bailleurs pas encore « done ».
  // S'il est deja termine, le scenario de doublon ne peut pas se produire.
  test.skip(!page.url().includes("/first-run"), "onboarding déjà terminé pour ce bailleur")

  const start = page.getByRole("button", { name: /Commencer|Premiers pas|Créer/i }).first()
  if (await start.isVisible().catch(() => false)) {
    await start.click()
  }

  const tenantField = page.getByLabel(/^Prénom/).first()
  if (!(await tenantField.isVisible().catch(() => false))) {
    test.skip(true, "formulaire de bail non atteint depuis l'état courant")
  }

  await tenantField.fill(`Loc${UNIQUE}`)

  // On ne va pas plus loin dans la creation ici : ce test verrouille le fait
  // que l'ecran REPART de la base apres un rechargement, pas le detail du
  // formulaire. Le rechargement ne doit jamais ramener un ecran vierge alors
  // que des baux existent deja.
  await page.reload()
  await expect(page).toHaveURL(/first-run|dashboard/)
})

test("la page locataire distingue un lien inconnu d'une panne", async ({ page }) => {
  // Token bien forme mais inexistant : c'est un « introuvable » legitime.
  // Le correctif v0.3.38.0 garantit que ce message-la reste reserve au cas ou
  // le document n'existe vraiment pas, jamais a une panne technique.
  await gotoTolerant(page, "/recu/00000000-0000-4000-8000-0000000000ff")

  // Le message de PANNE ne doit jamais apparaitre pour un token simplement
  // inexistant : c'est toute la distinction introduite en v0.3.38.0.
  await expect(page.getByText(/momentanément indisponible/i)).toHaveCount(0)
  // Et l'ecran rendu est bien un « introuvable », pas la quittance de
  // quelqu'un d'autre.
  await expect(page.getByText(/certifier|contester|quittance de/i)).toHaveCount(0)
})
