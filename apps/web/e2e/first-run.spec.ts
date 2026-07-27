import { expect, test } from "@playwright/test"

// Parcours de prise en main, AVEC données réelles et bailleur ISOLÉ.
//
// Ces tests étaient réputés impossibles : « l'auth Google seule (ADR-010)
// empêche un login automatisé ». C'était faux — le mode d'auth locale existe
// depuis longtemps. Deux choses manquaient vraiment :
//   1. SUPABASE_JWT_SECRET, sans quoi aucune session n'était forgée, les
//      lectures partaient en `anon` et la RLS bloquait tout : les specs dites
//      « authentifiées » ne pouvaient vérifier que des redirections ;
//   2. un bailleur PAR SPEC. Toutes partageaient le même utilisateur, donc une
//      spec qui écrivait cassait les autres.
//
// L'isolation passe par l'en-tête x-ranti-local-auth-user, résolu par requête
// (lib/auth/local-identity), avec la même double garde que le reste du mode
// local : inopérant en production. Les bailleurs sont semés dans
// supabase/seed.sql, chacun dans l'état exact que sa spec exerce.

const LANDLORD_HEADER = "x-ranti-local-auth-user"

// Semés par supabase/seed.sql.
const SANS_PROFIL = "00000000-0000-4000-8000-000000000001"
const GUIDE_SANS_BAIL = "00000000-0000-4000-8000-000000000002"
const GUIDE_AVEC_BAIL = "00000000-0000-4000-8000-000000000003"

// /first-run redirige côté SERVEUR vers /dashboard quand l'onboarding est
// terminé. Playwright abandonne alors la navigation (net::ERR_ABORTED) même si
// la redirection a abouti : on tolère l'abandon et on juge sur l'état final.
function seededTenant(page: import("@playwright/test").Page) {
  return page.getByText(/Locataire Reprise/i).filter({ visible: true }).first()
}

async function visit(page: import("@playwright/test").Page, url: string) {
  await page.goto(url).catch(() => {})
  await page.waitForLoadState("domcontentloaded").catch(() => {})
}

test.describe("bailleur guidé, sans bail", () => {
  test.use({ extraHTTPHeaders: { [LANDLORD_HEADER]: GUIDE_SANS_BAIL } })

  test("la prise en main s'ouvre, sans retomber sur la connexion", async ({ page }) => {
    await visit(page, "/first-run")
    await expect(page).toHaveURL(/first-run/)
    await expect(page.getByRole("button", { name: /Continuer avec Google/i })).toHaveCount(0)
  })
})

test.describe("bailleur guidé, avec un bail déjà créé", () => {
  test.use({ extraHTTPHeaders: { [LANDLORD_HEADER]: GUIDE_AVEC_BAIL } })

  // LA régression de v0.3.38.0. Avant le correctif, l'écran repartait vide et
  // invitait à ressaisir un bail existant : doublon de logement et de locataire
  // au premier contact avec le produit.
  test("le bail existant est reconstitué, pas redemandé", async ({ page }) => {
    await visit(page, "/first-run")
    await expect(page).toHaveURL(/first-run/)

    // Le locataire et le logement semés doivent apparaître : preuve que
    // l'écran est bien semé depuis la base et non repris de zéro.
    // `.filter({ visible: true })` : la mise en page rend le libellé plusieurs
    // fois (variante masquée selon la largeur), on vise celle qui s'affiche.
    await expect(seededTenant(page)).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText(/Chambre Reprise/i).filter({ visible: true }).first(),
    ).toBeVisible()
  })

  test("un rechargement ne perd pas le bail", async ({ page }) => {
    await visit(page, "/first-run")
    await expect(seededTenant(page)).toBeVisible({ timeout: 15_000 })

    await page.reload()

    // C'est ici que le bug se manifestait : après rechargement, l'écran
    // oubliait le bail et proposait de le créer.
    await expect(seededTenant(page)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("bailleur authentifié sans profil", () => {
  test.use({ extraHTTPHeaders: { [LANDLORD_HEADER]: SANS_PROFIL } })

  // Garde-fou de l'isolation elle-même : si une autre spec polluait ce
  // bailleur en lui créant un profil, ce test tomberait. Il vaut donc autant
  // pour le produit que pour la suite.
  test("reste renvoyé vers la création de profil", async ({ page }) => {
    await visit(page, "/first-run")
    await expect(page).toHaveURL(/onboarding/)
  })
})

test("un lien de quittance inconnu n'est pas présenté comme une panne", async ({ page }) => {
  await visit(page, "/recu/00000000-0000-4000-8000-0000000000ff")

  // Le message de PANNE est réservé aux vraies indisponibilités : c'est toute
  // la distinction introduite en v0.3.38.0.
  await expect(page.getByText(/momentanément indisponible/i)).toHaveCount(0)
  await expect(page.getByText(/certifier|contester/i)).toHaveCount(0)
})
