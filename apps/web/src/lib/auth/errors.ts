export class AuthError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "AuthError"
    this.code = code
  }
}

export function getSafeAuthErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Une erreur d’authentification est survenue."
}