# ADR-016 — Loyer par défaut du logement + création occupant/bail en un écran

## Statut

Accepté (2026-07-12).

## Contexte

Retours terrain du propriétaire pilote sur le flux d'onboarding :

1. Pour créer un locataire, il faut ressortir créer le logement quand celui-ci
   n'existe pas encore — le flux linéaire logement → locataire → bail est un
   cul-de-sac.
2. À la création d'un bail, on re-saisit le loyer et le jour d'échéance alors
   que « toutes les infos liées à la chambre sont déjà dispo » — sauf que le
   modèle ne stocke rien de tel sur le logement : loyer et périodicité vivent
   sur le **bail** (domain-model, décision 002).

`/units/bulk` (ADR implicite, PR #89) permet déjà logement + locataire + bail en
un écran, mais le chemin unitaire par défaut ne l'offre pas.

## Décision

### 1. Loyer et jour d'échéance par défaut sur le logement

Ajouter `units.default_rent_amount` et `units.default_due_day` (nullable,
migration `20260712030000`).

**Ce ne sont PAS une source de vérité.** Le bail reste maître : c'est lui qui
génère les échéances (domain-model 002). Ces colonnes ne sont qu'un **défaut de
pré-remplissage** : sélectionner un logement dans le formulaire de bail propose
son loyer et son jour, l'utilisateur relit et confirme, et peut les modifier.
Aucune échéance n'est jamais dérivée directement du logement.

### 2. Création d'un logement déjà occupé en un seul écran

Le formulaire `/units/new` gagne un interrupteur « Ce logement est déjà
occupé ». Si activé, on saisit le locataire et le bail dans le même écran, et
on passe par la RPC atomique `bulk_onboard_portfolio` (une ligne) — le même
chemin d'écriture que l'onboarding groupé, aucun chemin parallèle. Si le
logement est vacant, on peut renseigner le loyer par défaut (point 1) qui
pré-remplira ses futurs baux.

## Règles

- **Le bail reste la clé de voûte.** Les défauts du logement n'écrivent jamais
  d'échéance ; ils accélèrent la saisie du bail.
- **Aucun chemin d'écriture parallèle.** La création occupant+bail réutilise
  `bulk_onboard_portfolio` (validation + atomicité déjà éprouvées, PR #89).
- **Pré-remplissage non destructif.** Passer sur un logement sans loyer par
  défaut n'efface pas une valeur déjà saisie à la main dans le formulaire.
- **Défauts optionnels.** Un logement peut ne pas porter de prix (chambre
  jamais louée) : les colonnes sont nullable.

## Conséquences

- Onboarding terrain plus court : plus de cul-de-sac « ressortir créer le
  logement / le locataire ».
- Le formulaire de bail ne redemande plus le loyer/jour quand le logement les
  porte.
- Légère redondance assumée : une chambre occupée créée via l'écran combiné
  ne renseigne pas `default_rent_amount` (le loyer vit déjà sur son bail) ;
  ce défaut ne sert qu'aux futurs baux d'un logement vacant.

## Hors périmètre

- Modifier les défauts du logement depuis l'écran d'édition du logement
  (ajout simple, à faire au besoin).
- Reporter automatiquement le loyer d'un bail terminé vers le défaut du
  logement lors d'un changement de locataire.
