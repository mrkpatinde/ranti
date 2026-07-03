import { afterEach, describe, expect, it, vi } from "vitest"

// server.ts importe next/headers et next/navigation via ses voisins :
// on les neutralise, seul isLocalAuthEnabled est testé ici.
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

import { isLocalAuthEnabled } from "../server"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isLocalAuthEnabled", () => {
  it("RANTI_LOCAL_AUTH=true en dev → activé", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "true")
    expect(isLocalAuthEnabled()).toBe(true)
  })

  it("RANTI_LOCAL_AUTH=1 en dev → activé", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    expect(isLocalAuthEnabled()).toBe(true)
  })

  it("RANTI_LOCAL_AUTH=true en production → désactivé", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("RANTI_LOCAL_AUTH", "true")
    expect(isLocalAuthEnabled()).toBe(false)
  })

  it("RANTI_LOCAL_AUTH=1 en production → désactivé", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("RANTI_LOCAL_AUTH", "1")
    expect(isLocalAuthEnabled()).toBe(false)
  })

  it("variable absente → désactivé", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "")
    expect(isLocalAuthEnabled()).toBe(false)
  })

  it("autre valeur (yes) → désactivé", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("RANTI_LOCAL_AUTH", "yes")
    expect(isLocalAuthEnabled()).toBe(false)
  })
})
