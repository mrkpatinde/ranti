// Sprint 9 — smoke test LECTURE SEULE des surfaces publiques de production.
// Vérifie ce qu'un pilote verra avant tout compte : landing (tarif verrouillé),
// démo de vérification, conditions, login, et la PWA (manifest + service worker).
//
// Usage :  node scripts/smoke-prod.mjs [url]        (défaut : https://www.monranti.com)
// Prérequis : bun install (Playwright) ; Chromium de Playwright installé.
// Sortie : un JSON de constats + code de sortie 1 si un check échoue.
import { chromium } from "playwright"

const BASE = process.argv[2] ?? "https://www.monranti.com"

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 150)))

const results = {}

async function check(name, path, probe) {
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 25000 })
    await page.waitForTimeout(600)
    results[name] = { status: resp?.status(), ...(await probe()) }
  } catch (e) {
    results[name] = { error: String(e).slice(0, 120) }
  }
}

await check("landing", "/", async () => ({
  h1: (await page.locator("h1").first().textContent())?.trim(),
  tarifVerrouille: (await page.getByText("3 mois gratuits").count()) > 0,
}))
await check("verifier_demo", "/verifier/demo", async () => ({
  specimenSansVerdict:
    (await page.getByText("sans valeur probante", { exact: false }).count()) > 0 &&
    (await page.getByText("Document authentique").count()) === 0,
}))
await check("conditions", "/conditions", async () => ({
  tarifVerrouille: (await page.getByText("5 % sur chaque paiement de loyer réussi").count()) > 0,
  ancienTarifAbsent: (await page.getByText("500 F CFA").count()) === 0,
  resiliationAbsente: (await page.getByText("Résiliation").count()) === 0,
}))
await check("login", "/login", async () => ({
  google: (await page.getByText("Continuer avec Google").count()) > 0,
}))

// PWA : manifest + service worker servis, SW enregistré sur la landing.
await check("pwa", "/", async () => {
  await page.waitForTimeout(2500)
  return await page.evaluate(async () => {
    const mfResp = await fetch("/manifest.webmanifest").catch(() => null)
    const mf = mfResp?.ok ? await mfResp.json() : null
    const swResp = await fetch("/sw.js").catch(() => null)
    const reg = await navigator.serviceWorker?.getRegistration()
    return {
      manifest: mf ? { name: mf.name, icons: mf.icons?.length } : "ABSENT",
      swServi: !!swResp?.ok,
      swActif: !!reg?.active,
    }
  })
})

results.pageErrors = pageErrors.slice(0, 5)

const failed =
  Object.values(results).some((r) => r && typeof r === "object" && "error" in r) ||
  pageErrors.length > 0 ||
  results.conditions?.ancienTarifAbsent === false ||
  results.landing?.tarifVerrouille === false

console.log(JSON.stringify(results, null, 2))
console.log(failed ? "\nSMOKE: ÉCHEC — voir ci-dessus" : "\nSMOKE: OK")
await browser.close()
process.exit(failed ? 1 : 0)
