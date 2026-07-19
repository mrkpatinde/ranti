import { beforeEach, describe, expect, it, vi } from "vitest"

// Contrat du proxy de session (« Ne pas supprimer ») : updateSession doit
// (1) valider le JWT via getClaims — LOCAL, jamais getUser directement —,
// (2) suivre le patron canonique @supabase/ssr au refresh : cookies écrits
// d'abord sur la REQUÊTE, réponse reconstruite depuis la requête mutée,
// cookies reflétés sur la réponse renvoyée. Un refactor qui retire l'appel
// ou casse l'ordre d'écriture des cookies doit échouer ici, pas en prod.
type CookieRecord = { name: string; value: string; options?: object }
type CookieAdapter = {
  getAll: () => CookieRecord[]
  setAll: (cookies: CookieRecord[]) => void
}

const { createServerClient, getClaims, nextSpy } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  nextSpy: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}))

vi.mock("next/server", () => ({
  NextResponse: {
    next: (init: { request: unknown }) => {
      const response = {
        cookies: { set: vi.fn() },
        request: init.request,
      }
      nextSpy(init)
      return response
    },
  },
}))

import { updateSession } from "../middleware"

function makeRequest() {
  const set = vi.fn()
  return {
    cookies: {
      getAll: () => [{ name: "sb-token", value: "stale" }],
      set,
    },
  } as never
}

function capturedCookieAdapter(): CookieAdapter {
  const options = createServerClient.mock.calls[0][2] as { cookies: CookieAdapter }
  return options.cookies
}

beforeEach(() => {
  vi.clearAllMocks()
  getClaims.mockResolvedValue({ data: null, error: null })
  createServerClient.mockReturnValue({ auth: { getClaims } })
})

describe("updateSession", () => {
  it("valide la session via getClaims (local), exactement une fois, et rend la réponse", async () => {
    const response = await updateSession(makeRequest())
    expect(getClaims).toHaveBeenCalledTimes(1)
    expect(response).toBeDefined()
    expect(nextSpy).toHaveBeenCalledTimes(1)
  })

  it("expose les cookies de la requête au client Supabase", async () => {
    await updateSession(makeRequest())
    expect(capturedCookieAdapter().getAll()).toEqual([{ name: "sb-token", value: "stale" }])
  })

  it("refresh : écrit la requête d'abord, reconstruit la réponse, reflète les cookies dessus", async () => {
    const request = makeRequest()
    // Simule un rafraîchissement de session déclenché pendant getClaims.
    getClaims.mockImplementation(async () => {
      capturedCookieAdapter().setAll([{ name: "sb-token", value: "fresh", options: {} }])
      return { data: null, error: null }
    })

    const response = (await updateSession(request)) as unknown as {
      cookies: { set: ReturnType<typeof vi.fn> }
    }

    // 1. La requête reçoit le jeton frais (les Server Components du même
    //    passage liront la session rafraîchie, pas l'expirée).
    expect((request as { cookies: { set: ReturnType<typeof vi.fn> } }).cookies.set)
      .toHaveBeenCalledWith("sb-token", "fresh")
    // 2. La réponse a été reconstruite depuis la requête mutée.
    expect(nextSpy).toHaveBeenCalledTimes(2)
    // 3. La réponse RENVOYÉE porte le cookie frais pour le navigateur.
    expect(response.cookies.set).toHaveBeenCalledWith("sb-token", "fresh", {})
  })
})
