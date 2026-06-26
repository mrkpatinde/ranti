export const AUTH_PATHS = {
  signIn: "/login",
  afterSignIn: "/welcome",
  afterSignOut: "/",
  authError: "/auth/error",
} as const

export const PUBLIC_AUTH_PATHS = [
  "/",
  "/login",
  "/auth/confirm",
  "/auth/error",
] as const

export function isPublicAuthPath(pathname: string) {
  return PUBLIC_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}
