# Ranti — web application

Application web mobile-first pour les propriétaires africains. Stack : Next.js 16 (Turbopack), Supabase Auth + DB, Tailwind CSS.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # configurer les variables Supabase
npm run dev
```

Ouvrir [http://localhost:3300](http://localhost:3300).

## Mode développement sans SMS (local auth)

En développement, le fournisseur SMS Supabase peut être désactivé. Pour contourner
l'authentification réelle et tester les pages protégées sans recevoir d'OTP :

```bash
RANTI_LOCAL_AUTH=*** npm run dev
```

Ce mode :
- Injecte un `auth_user_id` et un `phone` factices pour toutes les requêtes
- Permet de tester le flux complet (dashboard, propriétés, baux, encaissements, reçus)
- **Ne fonctionne qu'en `NODE_ENV !== "production"`**
- Utilisé par les tests E2E Playwright (`playwright.config.ts`)

Variables optionnelles pour personnaliser l'identité locale :
- `RANTI_LOCAL_AUTH_USER_ID` (défaut : `00000000-0000-4000-8000-000000000001`)
- `RANTI_LOCAL_AUTH_PHONE` (défaut : `+229****0000`)

## Tests

```bash
npm test              # 91 tests unitaires + intégration + charge
npx playwright test   # 7 tests E2E (nécessite un navigateur)
```

## Build production

```bash
npm run build && npm start
```

## Déploiement

Vercel (monorepo, root directory = `apps/web`). Le workflow CI GitHub exécute
`lint` + `build` sur chaque push.
