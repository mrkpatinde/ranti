# ADR-008 — Ouverture Sénégal et Côte d'Ivoire, inscription Google uniquement

## Statut

Acceptée — 2026-07-03. Partiellement remplacée par ADR-010 (2026-07-10) :
les voies d'inscription/connexion par téléphone sont gelées, l'auth est
Google-only pour tous les pays. Le registre des pays et les plans de
numérotation restent en vigueur.

## Contexte

Ranti est lancé au Bénin avec une inscription par téléphone + mot de passe
(OTP SMS à la première inscription), et Google en second choix.

Nous ouvrons le Sénégal et la Côte d'Ivoire. L'envoi d'OTP SMS n'est pas
encore câblé pour ces deux pays.

## Décision

1. L'écran d'inscription propose un choix de pays : Bénin (par défaut),
   Sénégal, Côte d'Ivoire.
2. Bénin : inchangé — téléphone + mot de passe en voie principale, Google en
   second choix.
3. Sénégal et Côte d'Ivoire : **inscription via Google uniquement** pour le
   moment. Le formulaire téléphone + mot de passe est masqué quand un de ces
   pays est choisi.
4. Les plans de numérotation sont enregistrés dans le registre des pays
   (`apps/web/src/lib/auth/countries.ts`) pour la saisie des téléphones
   locataires et l'ouverture future de l'inscription par téléphone :
   - Bénin (+229) : 10 chiffres, mobiles en `01`.
   - Sénégal (+221) : plan fermé à 9 chiffres, mobiles en `70`, `75`, `76`,
     `77`, `78`.
   - Côte d'Ivoire (+225) : plan à 10 chiffres depuis janvier 2021 (PNN10,
     ARTCI), mobiles en `01` (Moov), `05` (MTN), `07` (Orange).

## Conséquences

- `welcome-flow.md` : la décision « l'identifiant principal est le
  téléphone » reste vraie au Bénin ; au Sénégal et en Côte d'Ivoire,
  l'identifiant est l'email Google tant que l'OTP SMS n'y est pas disponible.
- L'ouverture de l'inscription par téléphone dans un nouveau pays se fait en
  ajoutant `"phone_password"` aux `signupMethods` du pays dans le registre,
  une fois l'envoi SMS opérationnel.
- La validation `normalizePhone` (inscription) reste limitée au Bénin tant
  qu'aucun autre pays n'offre l'inscription par téléphone.
