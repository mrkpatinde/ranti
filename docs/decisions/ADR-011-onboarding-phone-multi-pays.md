# ADR-011 — Téléphone propriétaire multi-pays à l'onboarding

## Statut

Acceptée — 2026-07-10. Complète ADR-010 (auth Google-only) et ADR-008
(registre des pays).

## Contexte

Depuis ADR-010, l'inscription passe uniquement par Google, quel que soit le
pays. Mais l'étape profil de l'onboarding exigeait toujours un numéro béninois
(+229, composant `BeninPhoneInput`, validation `normalizePhone`) : un inscrit
au Sénégal ou en Côte d'Ivoire ne pouvait pas créer son espace propriétaire.

Le téléphone du propriétaire reste une donnée d'identité verrouillée (ADR-002)
et une colonne `not null unique` de `landlords`. ADR-003 (téléphone
obligatoire) concerne le locataire, pas le propriétaire — mais le numéro
propriétaire identifie le compte et apparaît dans le registre et les reçus.

## Décision

1. Le téléphone propriétaire reste **obligatoire** à l'onboarding, stocké en
   E.164, unique. Pas de téléphone optionnel : il identifie le compte et la
   colonne reste `not null unique` (pas de migration).
2. L'étape profil propose un **sélecteur d'indicatif** alimenté par le
   registre des pays (`apps/web/src/lib/auth/countries.ts`, ADR-008) :
   Bénin (défaut), Sénégal, Côte d'Ivoire. Le numéro local est validé côté
   serveur contre le plan de numérotation du pays choisi
   (`normalizeCountryPhone`).
3. Les comptes historiques téléphone + mot de passe (gelés, ADR-010) gardent
   la priorité de leur numéro vérifié (claims Supabase) sur le formulaire.
4. `normalizePhone` (auth gelée, Bénin uniquement) n'est **pas modifiée** :
   les parcours auth restent gelés tels quels.
5. **Ouvrir un nouveau pays** (ex. Togo) = ajouter son entrée (indicatif +
   plan de numérotation sourcé) au registre `COUNTRIES`. Aucun autre code à
   toucher. Un inscrit d'un pays hors registre ne peut pas encore compléter
   son profil.

## Conséquences

- Nouveau composant `CountryPhoneInput` (sélecteur indicatif + saisie locale
  groupée selon le plan) ; `BeninPhoneInput` reste utilisé pour les téléphones
  locataires (Bénin, ADR-003) tant que la saisie locataire n'est pas
  multi-pays.
- L'affichage du numéro (réglages profil) passe par le registre
  (`formatPhoneForDisplay`) au lieu du préfixe `+229` codé en dur.
- La saisie du téléphone **locataire** reste béninoise pour l'instant — à
  ouvrir aux plans du registre dans un second temps (les relances SMS ne sont
  câblées nulle part encore).
