import { describe, it, expect } from "vitest"
import { QueryError, failQuery } from "../query-error"

describe("QueryError", () => {
  it("creates error with resource name in message", () => {
    const err = new QueryError("landlords", "23505", "duplicate key")
    expect(err.message).toBe("[landlords] duplicate key")
    expect(err.resource).toBe("landlords")
    expect(err.code).toBe("23505")
    expect(err.name).toBe("QueryError")
  })

  it("classifies RLS errors (42501) as 'rls' kind", () => {
    const err = new QueryError("properties", "42501", "permission denied")
    expect(err.kind).toBe("rls")
  })

  it("classifies other errors as 'technical' kind", () => {
    const err = new QueryError("leases", "23505", "duplicate")
    expect(err.kind).toBe("technical")
  })

  it("classifies errors without code as 'technical'", () => {
    const err = new QueryError("units", undefined, "timeout")
    expect(err.kind).toBe("technical")
    expect(err.code).toBeUndefined()
  })
})

describe("failQuery", () => {
  it("throws QueryError", () => {
    expect(() => failQuery("landlords", { code: "P0001", message: "not found" })).toThrow(QueryError)
  })

  it("throws with correct resource and message", () => {
    let caught: QueryError | null = null
    try {
      failQuery("receipts", { code: "23505", message: "unique violation" })
    } catch (e) {
      caught = e as QueryError
    }
    expect(caught).toBeInstanceOf(QueryError)
    expect(caught!.resource).toBe("receipts")
    expect(caught!.message).toContain("[receipts]")
    expect(caught!.code).toBe("23505")
  })

  it("throws with undefined code (technical kind)", () => {
    let caught: QueryError | null = null
    try {
      failQuery("tenants", { message: "network error" })
    } catch (e) {
      caught = e as QueryError
    }
    expect(caught!.kind).toBe("technical")
    expect(caught!.code).toBeUndefined()
  })

  it("function returns never (type-level check via throw)", () => {
    // TypeScript-only: failQuery return type is never
    const fn: () => never = () => failQuery("test", { message: "err" })
    expect(fn).toThrow()
  })
})
