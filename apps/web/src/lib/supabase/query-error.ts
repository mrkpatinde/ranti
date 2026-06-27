// Shared query failure type so a DB/RLS error is never silently turned into
// "no data". Callers can tell apart: empty result, RLS denial, technical fault.
// Postgres reports RLS / permission denials with SQLSTATE 42501.
export type QueryErrorKind = "rls" | "technical"

export class QueryError extends Error {
  readonly kind: QueryErrorKind
  readonly code: string | undefined
  readonly resource: string

  constructor(resource: string, code: string | undefined, message: string) {
    super(`[${resource}] ${message}`)
    this.name = "QueryError"
    this.resource = resource
    this.code = code
    this.kind = code === "42501" ? "rls" : "technical"
  }
}

export function failQuery(
  resource: string,
  error: { code?: string; message: string }
): never {
  throw new QueryError(resource, error.code, error.message)
}
