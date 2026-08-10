import { expect, test } from "@playwright/test"

test("landing shows the primary call to action", async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: /La clôture de votre mois, en une heure/ }),
  ).toBeVisible()
  // CTA unique du hero (lien vers /signup, ADR-029) + entrée connexion.
  await expect(
    page.getByRole("link", { name: "Créer l'espace de votre agence" }).first(),
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Se connecter" }).first()).toBeVisible()
  // Micro-preuve du tarif ADR-028 : gratuit pour le moment, aucun palier
  // affiché (« Gratuit pour un logement » retiré, « 3 mois gratuits » banni
  // depuis v0.3.27.0). La landing agences porte l'engagement de préavis.
  await expect(page.getByText(/gratuit aujourd'hui/i).first()).toBeVisible()
  // Engagement non-custodial (ADR-030, CGU art. 3) affiché en clair.
  await expect(
    page.getByRole("heading", { name: "Les loyers ne passent jamais par Ranti" }),
  ).toBeVisible()
})

test("the demo verification page is static and honest about being an example", async ({ page }) => {
  await page.goto("/verifier/demo")
  await expect(page.getByText("Exemple de démonstration", { exact: true })).toBeVisible()
  await expect(page.getByText("Exemple — sans valeur probante")).toBeVisible()
  await expect(page.getByText("RNT-2026-DEMO")).toBeVisible()
  await expect(page.getByText("Document authentique", { exact: true })).toHaveCount(0)
})

test("the landing shows the real statement, not a generic mockup", async ({ page }) => {
  // ADR-029 : la pièce maîtresse est le relevé propriétaire, avec la même
  // structure que le PDF réel (lib/statements/pdf.tsx) et des chiffres qui
  // s'additionnent : encaissé 385 000, honoraires 30 800, net 354 200.
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Le relevé propriétaire" })).toBeVisible()
  await expect(page.getByText("Net à reverser au propriétaire")).toBeVisible()
  // formatFcfa sépare les milliers par une espace insécable (U+00A0).
  await expect(page.getByText(/354 200 FCFA/)).toBeVisible()
})

test("signup offers Google only", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.getByRole("heading", { name: "Créer l'espace de votre agence" })).toBeVisible()
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
  // Bifurcation d'entrée (2026-08-10) : les champs n'apparaissent qu'après
  // le choix entreprise / nom propre.
  await page.getByRole("button", { name: /Je gère en mon nom propre/ }).click()
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
  await page.getByRole("button", { name: /Je gère en mon nom propre/ }).click()
  await page.getByLabel(/^Numéro de téléphone/).fill("0190000000")
  await page.getByLabel(/^Prénom/).fill("A")
  await page.getByLabel(/^Nom/).fill("B")
  await page.getByRole("button", { name: "Accéder à mon espace" }).click()
  await expect(page.getByText("Indiquez votre prénom et votre nom.")).toBeVisible()
})
