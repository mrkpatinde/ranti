import { describe, expect, it } from "vitest"
import { SITE_URL, canonicalOAuthOrigin } from "@/lib/site"

// Régression du 9 août 2026 : la connexion Google renvoyait à la page
// d'accueil sans message. Le parcours partait de www.monranti.com et revenait
// sur monranti.com ; le cookie « code verifier » de PKCE, déposé sur www,
// n'était pas envoyé à l'apex. L'échange du code n'était jamais tenté — aucun
// appel /token dans les journaux Supabase, aucune session créée, quatre
// tentatives de suite.
describe("canonicalOAuthOrigin", () => {
  it("ramène www à l'apex", () => {
    expect(canonicalOAuthOrigin("www.monranti.com", "https")).toBe(SITE_URL)
  })

  it("laisse l'apex inchangé", () => {
    expect(canonicalOAuthOrigin("monranti.com", "https")).toBe(SITE_URL)
  })

  it("garde l'hôte d'une preview Vercel, sinon elle serait inconnectable", () => {
    expect(canonicalOAuthOrigin("ranti-git-pivot.vercel.app", "https")).toBe(
      "https://ranti-git-pivot.vercel.app"
    )
  })

  it("garde l'hôte local avec son port et son protocole", () => {
    expect(canonicalOAuthOrigin("localhost:3300", "http")).toBe("http://localhost:3300")
  })

  it("retombe sur la canonique quand l'en-tête d'hôte manque", () => {
    expect(canonicalOAuthOrigin(null, "https")).toBe(SITE_URL)
  })
})
