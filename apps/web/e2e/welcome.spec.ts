import { expect, test } from "@playwright/test"

test("landing shows the primary call to action", async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: /Le registre de loyer des propriétaires africains/ }),
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Gérer vos loyers" }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "Se connecter" }).first()).toBeVisible()
  await expect(page.getByText("3 mois gratuits").first()).toBeVisible()
})

test("the demo verification page is static and honest about being an example", async ({ page }) => {
  await page.goto("/verifier/demo")
  await expect(page.getByText("Exemple de démonstration", { exact: true })).toBeVisible()
  await expect(page.getByText("Exemple — sans valeur probante")).toBeVisible()
  await expect(page.getByText("RNT-2026-DEMO")).toBeVisible()
  await expect(page.getByText("Document authentique", { exact: true })).toHaveCount(0)
})

test("the landing links to the demo verification page", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: /Vérifier un exemple de quittance/ })).toHaveAttribute(
    "href",
    "/verifier/demo",
  )
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

test("profile offers the registry dial codes (ADR-011)", async ({ page }) => {
  await page.goto("/onboarding/profile")
  const country = page.getByLabel("Pays")
  await expect(country).toBeVisible()
  await expect(country.locator("option")).toHaveText(["🇧🇯 +229", "🇸🇳 +221", "🇨🇮 +225"])
  await country.selectOption("SN")
  await expect(page.getByLabel(/^Numéro de téléphone/)).toHaveAttribute(
    "placeholder",
    "77 123 45 67",
  )
})

test("profile rejects a too-short name", async ({ page }) => {
  await page.goto("/onboarding/profile")
  await page.getByLabel(/^Numéro de téléphone/).fill("0190000000")
  await page.getByLabel(/^Prénom/).fill("A")
  await page.getByLabel(/^Nom/).fill("B")
  await page.getByRole("button", { name: "Accéder à mon espace" }).click()
  await expect(page.getByText("Indiquez votre prénom et votre nom.")).toBeVisible()
})
