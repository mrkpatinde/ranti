import { expect, test } from "@playwright/test"

// Surfaces publiques : section tarif de la landing, page À propos, recherche
// de quittance par référence. Ces specs ne touchent pas la base : la validation
// de format de /verifier rend son message avant tout appel RPC, et les autres
// pages sont statiques.

test("la landing annonce le gratuit sans aucun prix (ADR-028)", async ({ page }) => {
  await page.goto("/")
  // La landing agences (ADR-029) porte l'engagement en une ligne sobre :
  // gratuit aujourd'hui, préavis avant tout tarif, rien à résilier.
  await expect(page.getByText(/gratuit aujourd'hui/i).first()).toBeVisible()
  await expect(page.getByText("sans limite de lots").first()).toBeVisible()
  await expect(page.getByText(/prévenue avant/).first()).toBeVisible()
  await expect(page.getByText(/rien à résilier/).first()).toBeVisible()
  // Aucun palier, aucun montant : la grille B-1 quitte la surface publique.
  await expect(page.getByText("Découverte", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Starter", { exact: true })).toHaveCount(0)
  await expect(page.getByText("1 à 5 logements")).toHaveCount(0)
  await expect(page.getByText("6 à 20 logements")).toHaveCount(0)
  await expect(page.getByText("2 mois offerts")).toHaveCount(0)
  await expect(page.getByText(/4\s*900|14\s*900|49\s*000|149\s*000/)).toHaveCount(0)
  // Le « 5 % » reste banni des surfaces publiques (ADR-024, maintenu par
  // ADR-028). Le « 8 % » du relevé spécimen est un taux d'honoraires d'agence,
  // pas une commission Ranti.
  await expect(page.getByText(/5\s*%/)).toHaveCount(0)
})

test("le footer porte les mentions légales et les pages publiques", async ({ page }) => {
  await page.goto("/")
  const footer = page.locator("footer")
  // Landing agences : le footer lie les trois pages publiques et porte la
  // raison sociale complète (RCCM, IFU, contact).
  await expect(footer.getByRole("link", { name: "À propos" })).toBeVisible()
  await expect(footer.getByRole("link", { name: "Conditions d'utilisation" })).toBeVisible()
  await expect(footer.getByRole("link", { name: "Confidentialité" })).toBeVisible()
  await expect(footer.getByText("WI'SOFT SOLUTIONS")).toBeVisible()
  await expect(footer.getByText("RCCM RB/COT/20 A 62590")).toBeVisible()
  // Rien d'annoncé qui n'existe pas : pas de Blog ni Carrières fantômes.
  await expect(footer.getByText("Blog")).toHaveCount(0)
  await expect(footer.getByText("Carrières")).toHaveCount(0)
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
