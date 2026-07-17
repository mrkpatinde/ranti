import { describe, expect, it } from "vitest"
import { readRequestId } from "../idempotency"

function fd(value?: string): FormData {
  const f = new FormData()
  if (value !== undefined) f.set("request_id", value)
  return f
}

describe("readRequestId", () => {
  it("accepte un UUID valide (espaces tolérés)", () => {
    expect(readRequestId(fd("c1111111-1111-1111-1111-111111111111"))).toBe(
      "c1111111-1111-1111-1111-111111111111",
    )
    expect(readRequestId(fd("  C1111111-1111-1111-1111-111111111111 "))).toBe(
      "C1111111-1111-1111-1111-111111111111",
    )
  })

  it("clé absente ou malformée → null (jamais bloquant)", () => {
    expect(readRequestId(fd())).toBeNull()
    expect(readRequestId(fd(""))).toBeNull()
    expect(readRequestId(fd("pas-un-uuid"))).toBeNull()
    expect(readRequestId(fd("c1111111-1111-1111-1111-11111111111"))).toBeNull()
  })
})
