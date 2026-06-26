import { defineConfig } from "@playwright/test"

const PORT = 3300

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pcxkxeesgusorrpmrkaj.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "sb_publishable_1FlNORQV34zaAI_KZ_2tXw_2flKjwWl",
      // Welcome flow E2E runs without an SMS provider: render protected routes
      // via local auth. Real OTP/SMS is not exercised here.
      RANTI_LOCAL_AUTH: "true",
    },
  },
})
