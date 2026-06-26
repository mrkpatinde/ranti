import { expect, test } from "@playwright/test"

test("landing shows the primary call to action", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Suivez vos loyers/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "Créer mon espace" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible()
})

test("signup asks for phone and password on one screen", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.getByRole("heading", { name: "Créer votre espace" })).toBeVisible()
  await expect(page.getByLabel("Numéro de téléphone")).toBeVisible()
  await expect(page.getByLabel("Mot de passe")).toBeVisible()
})

test("an authenticated user without a profile lands on the profile step", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/onboarding\/profile$/)
  await expect(page.getByRole("heading", { name: "Votre profil" })).toBeVisible()
})

test("login offers password recovery", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible()
  await page.getByRole("link", { name: "Mot de passe oublié" }).click()
  await expect(page).toHaveURL(/\/recover$/)
})

test("signup verification can resend the code", async ({ page }) => {
  await page.goto("/signup/verify?phone=%2B22990000000")
  await expect(page.getByRole("heading", { name: "Vérifiez votre numéro" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Renvoyer le code" })).toBeVisible()
})

test("profile rejects a too-short name", async ({ page }) => {
  await page.goto("/onboarding/profile")
  await page.getByLabel("Prénom", { exact: true }).fill("A")
  await page.getByLabel("Nom", { exact: true }).fill("B")
  await page.getByRole("button", { name: "Accéder à mon espace" }).click()
  await expect(page.getByText("Indiquez votre prénom et votre nom.")).toBeVisible()
})
