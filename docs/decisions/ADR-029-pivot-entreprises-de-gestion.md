# ADR-028 — Pivot : le client de Ranti devient l'entreprise de gestion immobilière

## Statut

Accepté — 2026-08-09 (décision CEO, en session). Supersède **ADR-001** sur la
définition du client (le titulaire du compte est une entreprise de gestion, pas
un bailleur particulier) et la disposition 4 d'**ADR-024** (tête de pont
bailleur diaspora). Le retrait du rail de paiement fait l'objet d'une décision
distincte : **ADR-029**.

Restent en vigueur sans modification, parce que le pivot ne touche pas la
mécanique locative : ADR-002 (verrou d'identité), ADR-003, ADR-004 (génération
des échéances), ADR-006 (cadence née du bail), ADR-007 (document après
validation), ADR-010 (auth Google), ADR-013 (contestation locataire), ADR-022
(envoi opéré hors application), ADR-023 (grand livre), ADR-025, ADR-026
(rent-only), ADR-027 (quittance conforme).

## Contexte

Ranti a été mis en ligne le 20 juillet 2026 pour le bailleur particulier
africain gérant 1 à 20 logements, avec la tête de pont diaspora retenue par
ADR-024. Trois semaines plus tard, l'adoption est nulle : aucun compte actif en
dehors des comptes de test, aucune relance envoyée depuis l'application, aucun
encaissement enregistré par un utilisateur réel.

Trois constats sur le segment particulier :

1. **La fréquence d'usage est faible.** Un bailleur de deux logements ouvre le
   produit deux fois par mois, pour deux lignes. La charge qu'il évite se
   compte en minutes.
2. **Il n'a pas de ligne budgétaire.** La dépense de gestion locative d'un
   particulier est une dépense personnelle, arbitrée contre un carnet et un fil
   WhatsApp qui coûtent zéro.
3. **L'acquisition se fait un par un.** Aucun bailleur particulier n'en amène
   un autre par le simple fait d'utiliser le produit.

L'entreprise de gestion immobilière (agence, administrateur de biens) présente
la configuration inverse. Elle gère des dizaines de lots pour le compte de
propriétaires tiers, sous mandat. Sa contrainte récurrente est la **clôture
mensuelle** : pour chaque mandant, établir ce qui a été encaissé sur ses lots,
ce qui a été retenu en honoraires, ce qui lui est reversé, et le justifier par
un document. Cette clôture se tient aujourd'hui sur Excel et WhatsApp, et
occupe trois à cinq jours par mois chez un administrateur de biens.

Le produit déjà construit couvre la mécanique dont cette clôture a besoin :
baux, échéances générées, encaissements avec allocations, quittances
numérotées, journal d'audit. Ce qui manquait tenait en quatre manques :
faire entrer un portefeuille existant, savoir pour qui chaque lot est géré,
produire le relevé mensuel, et relancer autrement que lot par lot.

## Décision

### 1. Le client est l'entreprise de gestion

Le compte connecté (`landlords`, un enregistrement par compte Supabase Auth)
est l'agence. Les écrans, la copie et les documents s'adressent à un
gestionnaire professionnel qui administre les biens d'autrui.

Le bailleur particulier reste techniquement servi — il gère ses propres biens,
sans mandant — mais il ne dicte plus les arbitrages produit.

### 2. Le propriétaire mandant est un canal de distribution

Chaque agence administre les lots de plusieurs propriétaires mandants. Chaque
mandant reçoit, chaque mois, un relevé produit par Ranti et remis par l'agence.
Un compte gagné met donc en circulation autant de documents portant la marque
qu'il y a de mandants au portefeuille, auprès de personnes qui possèdent des
biens et qui ont, elles aussi, un gestionnaire.

Ce canal ne demande aucune fonctionnalité supplémentaire : il naît du document
de clôture lui-même.

### 3. Le wedge est la clôture mensuelle du portefeuille

L'agence sait encaisser ; elle a un compte marchand, une banque et des
habitudes. Ce que Ranti prend en charge, c'est la fin du mois : la vue
d'ensemble par mandant (`owner_month_summary`), le relevé détaillé lot par lot
(`owner_statement`, `owner_statement_lines`) et son PDF.

Règle de calcul unique, posée par la migration `20260809120700` :
`encaissé` = allocations sur des encaissements confirmés dont la date de
réception tombe dans le mois ; `honoraires` = `floor(encaissé × fee_rate_bp /
10000)` calculé ligne par ligne ; `net` = `encaissé − honoraires`. Les totaux
sont la somme des lignes, de sorte qu'un mandant qui recompte à la main tombe
sur le même chiffre.

### 4. Le mandant n'est pas un utilisateur

Il ne crée pas de compte, ne se connecte pas, ne consulte aucun écran. Il
reçoit un document.

### 5. Quatre briques livrées

| Brique | Objet | Migration | Surface |
| :-- | :-- | :-- | :-- |
| 1 | Import de portefeuille par fichier | `20260809120600` | `/import` |
| 2 | Propriétaires mandants | `20260809120500` | `/owners` |
| 3 | Relevé mensuel et clôture | `20260809120700` | `/cloture` |
| 4 | Relances par lot | `20260809120800` | `/reminders/batch` |

## Architecture retenue

Le mandant n'étant pas un utilisateur, le cloisonnement des données n'a pas
besoin de le connaître. La table `public.owners` ajoute une **dimension de
regroupement au-dessus des biens** : `owners.landlord_id` rattache le mandant
au compte de l'agence, et `properties.owner_id` (nullable) rattache un bien à
son mandant. Un bien détenu en propre par le titulaire du compte garde
`owner_id` à `NULL`, ce qui laisse les portefeuilles existants valides sans
migration de données.

Conséquence directe : les **35 policies RLS**, le helper
`private.current_landlord_id()` et les gardes applicatives d'appartenance
restent inchangés. `owners` reçoit le même patron de policies que toute autre
table métier (`landlord_id = private.current_landlord_id()` en select, insert
et update), les mêmes triggers conventionnels (`set_updated_at`, `log_audit`,
`audit_soft_archive`), et le même index d'unicité par portefeuille
(`owners_landlord_name_unique` sur `lower(btrim(display_name))`), qui sert
aussi de clé de rapprochement à l'import.

C'est ce choix qui rend le pivot réalisable sans réécriture du socle : aucune
policy réécrite, aucun helper d'isolation modifié, aucune migration de données
sur les tables existantes.

Le prix payé est explicite : **un compte reste un portefeuille**. Deux employés
d'une même agence partagent aujourd'hui un identifiant ou travaillent sur deux
portefeuilles disjoints (voir « Remis à plus tard »).

## Conséquences

- **Vocabulaire.** « Bailleur » cède la place à « agence » ou « gestionnaire »
  dans les surfaces produit ; « mandant », « clôture », « honoraires de
  gestion » et « relevé propriétaire » entrent au glossaire.
- **Entrée dans le produit.** L'onboarding unitaire (un bail à la fois) ne
  suffit plus : une agence de 60 lots entre par l'import de fichier, en deux
  temps — validation ligne par ligne sans écriture, puis import tout-ou-rien
  idempotent par `p_request_id`.
- **Relances.** Le geste devient « je relance tous mes retards » en une passe.
  Ranti continue de ne rien envoyer lui-même : le message part du WhatsApp du
  gestionnaire par lien `wa.me`, et `log_reminder_batch` enregistre la trace
  du lot en un appel.
- **Navigation.** `/import`, `/owners`, `/cloture` et `/reminders/batch`
  rejoignent la barre principale (`src/components/app-shell.tsx`).
- **Documents de référence à réaligner** : `vision.md`, `positioning.md`,
  `personas.md`, `domain-model.md`, `glossary.md`, `database.md`, `api.md`,
  `roadmap.md`, `BUILD_STATUS.md`.
- **Tests.** La suite SQL (`supabase/tests/pivot_agences.test.sql` notamment)
  tourne en CI sur un Postgres 16 (`.github/workflows/ci.yml`).
- **Ce qui ne change pas.** La boucle bail → échéance → encaissement →
  quittance, le grand livre, la cadence de relance, le caractère non-custodial
  de l'encaissement (ADR-029).

## Remis à plus tard

Ces trois chantiers sont reconnus comme nécessaires et volontairement non
engagés. Aucun n'est un prérequis de la clôture mensuelle.

1. **Partage du compte entre les employés d'une agence, avec rôles.** Un compte
   égale un portefeuille. Ouvrir plusieurs identités sur un même portefeuille
   suppose une table de membres, une résolution de `current_landlord_id()` à
   plusieurs comptes auth, et une matrice de droits (qui encaisse, qui
   clôture, qui exporte). Réouverture : première agence à plus de deux
   personnes sur le même portefeuille.
2. **Paiement du locataire par PSP au nom de l'agence.** Le locataire paierait
   dans le produit, sur le compte marchand de l'agence, sans que Ranti touche
   les fonds. Distinct du rail supprimé par ADR-029, qui faisait transiter
   l'argent par un wallet au nom de Ranti. Réouverture : demande d'agences
   déjà clientes, et montage validé qui laisse Ranti hors du flux.
3. **Services financiers sur l'historique locatif.** L'historique d'encaissement
   d'un portefeuille est une donnée de solvabilité (avance sur loyers, garantie
   locative, scoring). Aucune exploration avant une base d'historique réelle et
   un cadre réglementaire vérifié.

## Alternatives écartées

**Cloisonnement à deux niveaux (agence → mandant → bien).** Faire du mandant
une frontière d'isolation dans la base imposait de réécrire les 35 policies
RLS, le helper `private.current_landlord_id()` et les gardes applicatives
correspondantes. Ce coût n'achète rien tant que le mandant ne se connecte pas.
Écarté au profit de la dimension de regroupement.

**Portail propriétaire (le mandant se connecte).** Ajoute un second type
d'utilisateur, un second parcours d'authentification, une seconde surface de
support et une seconde interface, avant tout signal terrain. Le besoin observé
du mandant est de recevoir un décompte justifié, ce que couvre le relevé.

**Servir les deux segments en parallèle.** Le particulier et l'agence ne
partagent ni le volume, ni le vocabulaire, ni le moment de vérité mensuel.
Maintenir les deux parcours double la surface produit pour un segment dont
l'adoption mesurée est nulle.

**Repartir d'un produit neuf pour les agences.** La mécanique locative déjà
livrée (échéances, allocations, quittances, audit, RLS) représente l'essentiel
du travail et reste valable telle quelle. Le pivot porte sur le client et sur
quatre briques, pas sur le socle.

## Critères de réouverture

- Trois agences utilisatrices dont la clôture mensuelle passe intégralement par
  Ranti, sur deux mois consécutifs.
- Une agence bloquée par l'absence de partage de compte entre employés :
  ouvre le chantier 1 des « Remis à plus tard ».
