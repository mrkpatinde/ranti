# ADR-010 — Authentification Google uniquement (tous pays)

## Statut

Acceptée — 2026-07-10. Remplace les voies téléphone de l'ADR-008 ; l'ADR-008
reste valable pour le registre des pays et les plans de numérotation.

## Contexte

L'inscription au Bénin passait par téléphone + mot de passe (OTP SMS à la
première inscription), Google en second choix. Sénégal et Côte d'Ivoire
étaient déjà Google-only (ADR-008). L'envoi d'OTP SMS n'est pas opérationnel
et le maintien de deux parcours complique l'accueil.

## Décision

1. **Inscription et connexion passent uniquement par Google**, quel que soit
   le pays. Le choix de pays à l'inscription est retiré.
2. Les parcours téléphone/mot de passe/OTP/récupération sont **gelés, pas
   supprimés** : les actions serveur (`lib/auth/actions.ts`), la validation
   (`normalizePhone`, `normalizeOtp`) et les composants `phone-field` /
   `password-field` restent dans le code, mais aucune page ne les expose.
   `/recover` et `/signup/verify` redirigent vers `/login` et `/signup`.
3. Le provider Phone Supabase peut rester désactivé.
4. Dégel futur : re-brancher les formulaires sur les actions existantes et
   réactiver le provider Phone, pays par pays via `signupMethods` du registre
   (mécanique ADR-008 inchangée).

## Conséquences

- `welcome-flow.md` : l'identifiant principal devient l'email Google pour
  tous les pays ; plus de mot de passe ni d'OTP dans le parcours normal.
- ADR-002 : la « règle spéciale » de changement de téléphone comme identifiant
  de connexion devient sans objet tant que l'auth téléphone est gelée ; le
  téléphone reste une donnée d'identité verrouillée.
- Les comptes existants créés par téléphone + mot de passe ne peuvent plus se
  connecter tant que le gel dure. À traiter avant tout dégel ou migration
  (rapprochement par numéro vérifié).
- L'onboarding profil exige toujours un numéro béninois (+229) — contrainte à
  lever pour les inscrits hors Bénin (déjà notée dans BUILD_STATUS).
- Le registre des pays (`countries.ts`) est conservé pour les téléphones
  locataires et le dégel futur.
