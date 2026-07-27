import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Isolation par utilisateur pour les E2E : le sujet d'auth locale se choisit
// PAR REQUÊTE via un en-tête, au lieu d'être figé au démarrage du serveur.
//
// Ce qui doit être verrouillé ici, c'est la SÛRETÉ : l'en-tête ne doit rien
// pouvoir en production, et une valeur arbitraire ne doit jamais atterrir dans
// un JWT.

const { headersGet } = vi.hoisted(() => ({ headersGet: vi.fn() }))

vi.mock("next/headers", () => ({
  headers: async () => ({ get: headersGet }),
}))

import {
  LOCAL_AUTH_USER_HEADER,
  isLocalAuthEnabled,
  resolveLocalAuthUserId,
} from "../local-identity"

const DEFAULT_ID = "00000000-0000-4000-8000-000000000001"
const OTHER_ID = "00000000-0000-4000-8000-000000000002"

beforeEach(() => {
  vi.clearAllMocks()
  headersGet.mockReturnValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveLocalAuthUserId", () => {
  it("mode local + en-tête UUID : le sujet demandé l'emporte", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    headersGet.mockReturnValue(OTHER_ID)
    await expect(resolveLocalAuthUserId()).resolves.toBe(OTHER_ID)
    expect(headersGet).toHaveBeenCalledWith(LOCAL_AUTH_USER_HEADER)
  })

  // LE test qui compte : en production, l'en-tête n'est même pas lu.
  it("production : l'en-tête est ignoré, et jamais lu", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    headersGet.mockReturnValue(OTHER_ID)
    await expect(resolveLocalAuthUserId()).resolves.toBe(DEFAULT_ID)
    expect(headersGet).not.toHaveBeenCalled()
  })

  it("mode local désactivé : l'en-tête est ignoré", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "")
    headersGet.mockReturnValue(OTHER_ID)
    await expect(resolveLocalAuthUserId()).resolves.toBe(DEFAULT_ID)
    expect(headersGet).not.toHaveBeenCalled()
  })

  // Une valeur arbitraire ne doit jamais être injectée telle quelle dans le
  // sujet d'un JWT : on retombe sur le défaut.
  it.each([
    ["pas un uuid", "robert'); drop table receipts;--"],
    ["uuid tronqué", "00000000-0000-4000-8000"],
    ["chaîne vide", "   "],
  ])("en-tête non conforme (%s) : défaut", async (_label, value) => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    headersGet.mockReturnValue(value)
    await expect(resolveLocalAuthUserId()).resolves.toBe(DEFAULT_ID)
  })

  it("hors contexte de requête : défaut, jamais une exception", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    headersGet.mockImplementation(() => {
      throw new Error("headers() hors requête")
    })
    await expect(resolveLocalAuthUserId()).resolves.toBe(DEFAULT_ID)
  })

  it("sans en-tête : RANTI_LOCAL_AUTH_USER_ID sert de repli", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    vi.stubEnv("RANTI_LOCAL_AUTH_USER_ID", OTHER_ID)
    await expect(resolveLocalAuthUserId()).resolves.toBe(OTHER_ID)
  })
})

describe("isLocalAuthEnabled", () => {
  it.each([
    ["development", "true", true],
    ["development", "1", true],
    ["development", "yes", false],
    ["production", "true", false],
    ["production", "1", false],
  ])("NODE_ENV=%s RANTI_LOCAL_AUTH=%s -> %s", (env, flag, expected) => {
    vi.stubEnv("NODE_ENV", env)
    vi.stubEnv("RANTI_LOCAL_AUTH", flag)
    expect(isLocalAuthEnabled()).toBe(expected)
  })
})
