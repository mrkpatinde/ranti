import { expect, test } from "@playwright/test"

test("landing shows the primary call to action", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Vos loyers, sans confusion/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "Ouvrir mon espace propriétaire" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible()
})

test("signup offers Google only", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.getByRole("heading", { name: "Créer votre espace" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()
  await expect(page.getByLabel("Numéro de téléphone")).toHaveCount(0)
  await expect(page.getByLabel("Mot de passe")).toHaveCount(0)
})

test("an authenticated user without a profile lands on the profile step", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/onboarding/)
  await expect(page.getByRole("heading", { name: "Votre profil" })).toBeVisible()
})

test("property creation requires a completed landlord profile", async ({ page }) => {
  await page.goto("/properties/new")
  await expect(page).toHaveURL(/onboarding/)
  await expect(page.getByRole("heading", { name: "Votre profil" })).toBeVisible()
})

test("login offers Google only", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()
  await expect(page.getByLabel("Mot de passe")).toHaveCount(0)
})

test("frozen phone-auth pages redirect", async ({ page }) => {
  await page.goto("/recover")
  await expect(page).toHaveURL(/login/)
  await page.goto("/signup/verify?phone=%2B22990000000")
  await expect(page).toHaveURL(/signup/)
})

test("profile rejects a too-short name", async ({ page }) => {
  await page.goto("/onboarding/profile")
  await page.getByLabel("Prénom", { exact: true }).fill("A")
  await page.getByLabel("Nom", { exact: true }).fill("B")
  await page.getByRole("button", { name: "Accéder à mon espace" }).click()
  await expect(page.getByText("Indiquez votre prénom et votre nom.")).toBeVisible()
})
