import { describe, expect, it } from "vitest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { SITE_URL } from "@/lib/site"

// Garde-fou de la canonique. Google dédoublonnait http/www/apex et retenait www
// faute de signal explicite ; le domaine de production Vercel est l'apex et le
// code doit déclarer la même chose. Si quelqu'un rebascule SITE_URL sur www, ces
// tests cassent avant que Search Console ne reparte deviner.
describe("SITE_URL", () => {
  it("apex, jamais www", () => {
    expect(SITE_URL).toBe("https://monranti.com")
    expect(SITE_URL).not.toContain("www.")
  })

  it("pas de barre finale (sinon les URLs absolues doublent le slash)", () => {
    expect(SITE_URL.endsWith("/")).toBe(false)
  })
})

describe("sitemap", () => {
  const entries = sitemap()

  it("ne liste que les pages publiques indexables", () => {
    expect(entries.map((e) => e.url)).toEqual([
      "https://monranti.com",
      "https://monranti.com/conditions",
      "https://monranti.com/confidentialite",
    ])
  })

  it("aucune surface privée (espace connecté, reçus par jeton)", () => {
    const urls = entries.map((e) => e.url).join(" ")
    expect(urls).not.toContain("/recu/")
    expect(urls).not.toContain("/dashboard")
    expect(urls).not.toContain("/leases")
  })

  it("toutes les URLs en apex", () => {
    for (const e of entries) {
      expect(e.url.startsWith("https://monranti.com")).toBe(true)
      expect(e.url).not.toContain("www.")
    }
  })

  it("la landing prime sur les pages légales", () => {
    const [landing, ...legal] = entries
    expect(landing.priority).toBe(1)
    for (const page of legal) {
      expect(page.priority).toBe(0.5)
    }
  })

  it("chaque entrée porte une date de dernière modification", () => {
    for (const e of entries) {
      expect(e.lastModified).toBeInstanceOf(Date)
    }
  })
})

describe("robots", () => {
  const r = robots()

  it("autorise le public", () => {
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" })
  })

  it("bloque les quittances par jeton (données locataire nominatives)", () => {
    expect(r.rules).toMatchObject({ disallow: ["/recu/"] })
  })

  it("sitemap et host en apex", () => {
    expect(r.sitemap).toBe("https://monranti.com/sitemap.xml")
    expect(r.host).toBe("https://monranti.com")
  })

  it("aucune référence à www", () => {
    expect(JSON.stringify(r)).not.toContain("www.")
  })
})
