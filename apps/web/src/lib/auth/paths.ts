export const AUTH_PATHS = {
  signIn: "/login",
  signUp: "/signup",
  signUpVerify: "/signup/verify",
  recover: "/recover",
  profile: "/onboarding/profile",
  afterSignIn: "/dashboard",
  afterSignOut: "/",
  authError: "/auth/error",
  authCallback: "/auth/callback",
} as const
