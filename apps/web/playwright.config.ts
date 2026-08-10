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
      // Cible par DÉFAUT la pile Supabase LOCALE (`supabase start`), jamais la
      // production. Le défaut precedent pointait sur le projet de prod
      // (pcxkxeesgusorrpmrkaj) : combiné à RANTI_LOCAL_AUTH ci-dessous et à un
      // SUPABASE_JWT_SECRET de prod, une suite E2E aurait écrit dans la base
      // réelle des bailleurs. Les identifiants ci-dessous sont les valeurs
      // publiques et fixes du stack local Supabase — ce ne sont pas des secrets.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      // Secret JWT du stack LOCAL : sans lui, mintLocalAuthToken() renvoie null,
      // les lectures partent en `anon`, la RLS les bloque, et les tests dits
      // « authentifiés » ne peuvent vérifier que des redirections — jamais des
      // données. C'est ce qui manquait pour couvrir /recu et le dashboard.
      SUPABASE_JWT_SECRET:
        process.env.SUPABASE_JWT_SECRET ??
        "super-secret-jwt-token-with-at-least-32-characters-long",
      // Rend les routes protégées sans OTP/SMS. Double garde côté app :
      // inopérant dès que NODE_ENV vaut production (lib/auth/server.ts).
      RANTI_LOCAL_AUTH: "true",
    },
  },
})
