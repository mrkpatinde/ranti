# Ranti — Welcome Flow

## Statut

Version 1.5 — mise à jour 2026-07-18 (v0.3.29.0) : prise en main guidée (FirstRun) câblée à la base ; nouvelle section « Prise en main guidée » ci-dessous. Le statut d'onboarding vit sur `landlords.onboarding_status`.

Version 1.4 — mise à jour 2026-07-16 : le document rejoint l'UI livrée — civilité retirée du profil minimal (PR #122), tableau de bord vide aligné sur l'action unique « Créer un bail » (ADR-020, la section citait encore « Ajouter un bien »).

Version 1.3 — mise à jour 2026-07-15 : entrée d'onboarding unique « créer un bail » (ADR-020) ; l'écran bail crée lieu + logement + occupant + bail et génère les échéances immédiatement.

Version 1.2 — mise à jour 2026-07-10 : auth Google uniquement (ADR-010) ; téléphone propriétaire multi-pays à l'onboarding (ADR-011).

Ce document décrit l'expérience d'accueil du propriétaire, depuis la première ouverture de Ranti jusqu'au tableau de bord vide.

Il ne décrit pas les écrans en détail. Il décrit le parcours, les décisions verrouillées et les critères de succès.

---

## Objectif

Un propriétaire doit pouvoir créer son espace Ranti et accéder à son tableau de bord vide en moins de 2 minutes.

Le propriétaire ne doit pas avoir l'impression de créer un compte administratif.

Il doit avoir l'impression d'entrer dans son cahier de loyers.

---

## Décisions verrouillées

### Pays

- Aucun choix de pays à l'inscription : l'inscription et la connexion passent uniquement par Google, quel que soit le pays (voir ADR-010).
- Le registre des pays (ADR-008) reste utilisé pour les numéros de téléphone des locataires.

### Authentification

- L'identifiant principal est l'email Google (ADR-010).
- Pas de mot de passe, pas d'OTP dans le parcours normal.
- Les parcours téléphone + mot de passe et OTP sont gelés, pas supprimés — le code reste prêt pour un dégel pays par pays (ADR-010).
- L'authentification est gérée par Supabase Auth (OAuth Google).
- Ranti ne stocke pas de secrets d'authentification dans les tables métier.

### Propriétaire

- La table métier `landlords` est liée à `auth.users` par `auth_user_id`.
- Aucun propriétaire métier n'est créé automatiquement au moment brut de création du compte auth.
- Le propriétaire métier est créé seulement après connexion Google et saisie du profil minimal.

### Profil minimal

Les seules informations demandées au démarrage sont :

- numéro de téléphone mobile (indicatif choisi dans le registre des pays — Bénin par défaut, Sénégal, Côte d'Ivoire ; voir ADR-011) ;
- prénom ;
- nom.

La civilité a été retirée de l'UI (retour terrain, PR #122) ; la colonne reste en base pour un éventuel retour.

Aucun email, adresse, devise ou document d'identité n'est demandé dans le MVP Welcome. Le pays n'apparaît qu'à travers l'indicatif téléphonique.

---

## Parcours — Nouveau propriétaire

1. Le propriétaire ouvre Ranti.
2. Il comprend immédiatement que Ranti sert à suivre ses loyers, les retards et les reçus.
3. Il choisit de commencer.
4. Il continue avec Google.
5. Il renseigne son profil minimal : numéro mobile (indicatif de son pays), prénom, nom.
6. Ranti crée son espace propriétaire.
7. Il arrive sur un tableau de bord vide.
8. Ranti lui propose une seule prochaine action : créer un bail (ADR-020) — l'écran bail crée le lieu, le logement, l'occupant et le bail en un geste, et génère les échéances immédiatement.

---

## Parcours — Propriétaire existant

1. Le propriétaire ouvre Ranti.
2. Il continue avec Google.
3. Ranti reconnaît son espace.
4. Il arrive directement sur son tableau de bord.

Aucune saisie de mot de passe ni vérification OTP dans la connexion normale.

---

## Tableau de bord vide

Le tableau de bord vide ne doit jamais ressembler à une page vide.

Message attendu (ADR-020) :

> Bonjour, Adonis.
>
> Créer votre premier bail — lieu, logement, occupant et loyer en un geste.

Action principale :

> Créer un bail

Aucune autre action ne doit concurrencer ce premier pas.

---

## Prise en main guidée (FirstRun)

Depuis la v0.3.26.0, l'arrivée sur le tableau de bord est accompagnée d'une prise en main guidée, portée du prototype `design_handoff_first_run/` (qui fait foi visuellement).

### Statut d'onboarding

`landlords.onboarding_status` persiste l'intention, jamais la progression :

- `pending` : accueil pas encore vu (nouvelle inscription) ;
- `guided` : prise en main en cours (checklist « Premiers pas ») ;
- `exploring` : « Passer pour l'instant », tableau de bord vide honnête ;
- `done` : premiers pas terminés.

La progression des étapes (bail, encaissement, quittance, relance) est dérivée des données réelles au rendu (`lib/onboarding/progress.ts`), jamais stockée.

### Surfaces

- **Rail « Premiers pas » sur le tableau de bord** (v0.3.28.0) : checklist guidée + centre d'aide.
- **Parcours `/first-run`** (v0.3.29.0) : portage fidèle du prototype (welcome, 4 vues, modales), derrière l'auth (`requireLandlordProfile`) et câblé à la base. Le parcours crée un vrai bail (`bulk_onboard_portfolio`), valide un vrai paiement (`record_collection` + `confirm_collection`) et émet une vraie quittance (`generate_receipt`) ; idempotence par `request_id` (une reprise après coupure réseau rejoue la même écriture, jamais deux paiements). Les réglages de relance saisis dans le parcours sont persistés sur `landlords` et resservis à l'ouverture. Un bailleur `done` est redirigé vers `/dashboard`.

Limites connues (TODOS) : `/first-run` n'est pas encore la destination automatique après connexion, et un bailleur `guided`/`exploring` qui recharge la route revoit un état de départ (la progression n'est pas encore hydratée depuis les données).

---

## Cas particuliers

### Compte Google déjà connu

Si le compte Google existe déjà, la connexion Google ramène directement à l'espace existant — inscription et connexion sont le même geste.

### Récupération de compte

Gérée par Google (pas de mot de passe Ranti). Les pages `/recover` et `/signup/verify` redirigent vers la connexion.

### Comptes historiques téléphone + mot de passe

Ne peuvent plus se connecter tant que l'auth téléphone est gelée (voir ADR-010).

### Profil incomplet

Si un utilisateur auth existe mais que le profil propriétaire n'est pas complet, Ranti reprend le parcours au profil minimal.

---

## Critères de succès

Le Sprint 2 est réussi si :

- un nouveau propriétaire peut créer son espace en moins de 2 minutes ;
- un propriétaire existant revient d'un seul geste Google ;
- un propriétaire ne voit jamais les données d'un autre propriétaire ;
- le tableau de bord vide est clair et rassurant ;
- le propriétaire sait immédiatement quoi faire ensuite ;
- aucune information inutile n'est demandée avant le premier bien.

---

## Principe UX

Le propriétaire ne crée pas un compte.

Il entre chez lui.
