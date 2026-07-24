import { expect, test } from "@playwright/test"

// Surfaces publiques ajoutées le 2026-07-24 : tarifs B-1 sur la landing,
// page À propos, recherche de quittance par référence. Ces specs ne touchent
// pas la base : la validation de format de /verifier rend son message avant
// tout appel RPC, et les autres pages sont statiques.

test("la landing affiche la grille tarifaire B-1 (ADR-024)", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Tarifs", exact: true })).toBeVisible()
  await expect(page.getByText("Découverte", { exact: true })).toBeVisible()
  await expect(page.getByText("Starter", { exact: true })).toBeVisible()
  await expect(page.getByText("Pro", { exact: true })).toBeVisible()
  await expect(page.getByText("1 à 5 logements")).toBeVisible()
  await expect(page.getByText("6 à 20 logements")).toBeVisible()
  // Annuel mis en avant : « Gratuit » (jamais « 0 F ») et 2 mois offerts.
  await expect(page.getByText("Gratuit", { exact: true })).toBeVisible()
  await expect(page.getByText("0 F", { exact: true })).toHaveCount(0)
  await expect(page.getByText("2 mois offerts").first()).toBeVisible()
  await expect(page.getByText("49 000", { exact: true })).toBeVisible()
  await expect(page.getByText("149 000", { exact: true })).toBeVisible()
  // Le « 5 % » est banni des surfaces publiques (ADR-024) : motif large pour
  // attraper aussi « 5% » et variantes d'espacement.
  await expect(page.getByText(/5\s*%/)).toHaveCount(0)
})

test("le footer annonce Blog et Carrières sans lien mort", async ({ page }) => {
  await page.goto("/")
  const footer = page.locator("footer")
  await expect(footer.getByText("Blog")).toBeVisible()
  await expect(footer.getByText("Carrières")).toBeVisible()
  await expect(footer.getByText("Bientôt").first()).toBeVisible()
  // Annoncés, pas liés : aucun <a> Blog/Carrières tant que les pages n'existent pas.
  await expect(footer.getByRole("link", { name: "Blog" })).toHaveCount(0)
  await expect(footer.getByRole("link", { name: "Carrières" })).toHaveCount(0)
  // La raison sociale vit sur /a-propos, plus dans le footer.
  await expect(footer.getByText("WI'SOFT")).toHaveCount(0)
})

test("la page À propos porte l'éditeur et la posture non-custodiale", async ({ page }) => {
  await page.goto("/a-propos")
  await expect(page.getByRole("heading", { name: "À propos de Ranti" })).toBeVisible()
  await expect(page.getByText("WI'SOFT SOLUTIONS")).toBeVisible()
  await expect(page.getByText("RCCM RB/COT/20 A 62590")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Ranti ne touche jamais l'argent" })).toBeVisible()
})

test("la recherche de quittance refuse un format étranger sans appeler la base", async ({ page }) => {
  await page.goto("/verifier?ref=PAS-UNE-REF")
  await expect(page.getByRole("heading", { name: "Vérifier une quittance" })).toBeVisible()
  await expect(page.getByText("Ce n'est pas une référence Ranti")).toBeVisible()
})

test("la recherche de quittance expose le champ et le rappel de confidentialité", async ({ page }) => {
  await page.goto("/verifier")
  await expect(page.getByPlaceholder("RNT-2026-0001")).toBeVisible()
  await expect(page.getByRole("button", { name: "Vérifier" })).toBeVisible()
  await expect(page.getByText("ni nom, ni logement, ni montant")).toBeVisible()
})
