# ADR-023 — Grand Livre de Confiance : le compte courant locatif devient le cœur du système

## Statut

Accepté (2026-07-16, décision CEO — pivot stratégique « Grand Livre de
Confiance »). Révisé le même jour (v2) : matrice de validation exhaustive et
cycle de vie du litige, préalables au backfill de la Phase 1. Précisé (v2.1,
même jour, livraison de la phase Expand) : colonnes `occurred_at` /
`disputed_at` / `legacy_ref`, miroir par triggers en base plutôt que double
écriture applicative, correspondance de backfill étendue aux échéances
annulées/archivées, exigibilité héritée par la contre-passation.

Ce document est la **référence d'alignement** de toutes les parties prenantes
sur les règles de gestion du grand livre. En cas de divergence entre une
implémentation et cette ADR, c'est l'implémentation qui a tort.

Positionnement vis-à-vis des ADR existantes :

- **Amende ADR-004** : les règles de génération des échéances restent
  intégralement valables ; leur cible devient une ligne de débit du grand
  livre au lieu d'une table dédiée (voir § Décision 2).
- **Amende ADR-005** : la correction par événement correctif est généralisée ;
  le flux « annuler l'encaissement » devient, pour un crédit déjà validé, une
  contre-passation soumise à validation locataire (voir § Matrice, ligne 7).
- **Généralise ADR-013** : le cycle Valider/Contester par lien token,
  aujourd'hui limité au reçu, devient le mécanisme de toute ligne affirmée
  unilatéralement.
- **Ne touche pas ADR-022** : le contrat d'envoi des relances (ranti-ops,
  `reminder_events`) est inchangé ; seule la source des retards évolue.

## Contexte

Le terrain a montré que le problème central n'est pas le reçu. C'est :

1. **les impayés** — le propriétaire veut voir immédiatement qui est en
   retard et de combien ;
2. **les litiges sur les charges variables** — réparations, frais annexes,
   aujourd'hui hors système (registre papier, WhatsApp, mémoire) ;
3. **l'absence de source de vérité partagée** entre propriétaire et
   locataire — chacun tient son compte, le désaccord est structurel.

Le modèle actuel est linéaire : `rent_dues` → `rent_reception_allocations` →
`rent_receptions` → `receipts`. Il ne connaît que le loyer, et le reçu en est
la finalité. Or `rent_reception_allocations` est déjà une table d'affectation
crédit → dette : l'embryon d'un grand livre existe, il n'est ni généralisé ni
exposé.

Le locataire, lui, n'existe que comme spectateur : une fiche `tenants`, un
lien de déclaration pré-paiement (`/confirmer/[token]`), un acquittement de
reçu (ADR-013). Il ne peut ni voir son solde ni se prononcer sur une dette
avant qu'elle ne soit considérée comme acquise.

**Repositionnement produit** : Ranti n'est plus un générateur de documents,
c'est le compte courant locatif partagé — l'arbitre digital de la relation.
Le reçu et la quittance deviennent des *sorties* du grand livre, pas son cœur.

## Décision

### 1. Nouvelle entité centrale : `transactions`

Toute somme due ou reçue sur un bail est une ligne d'un même grand livre.

| Colonne | Type / valeurs | Rôle |
| :-- | :-- | :-- |
| `id`, `landlord_id`, `lease_id` | uuid | isolement propriétaire (RLS) + rattachement au bail |
| `type` | `loyer` \| `reparation` \| `frais` \| `reglement` \| `contre_passation` | nature de la ligne |
| `direction` | `debit` (dû par le locataire) \| `credit` (reçu du locataire) | sens comptable |
| `amount` | int (FCFA) | toujours positif ; le sens vient de `direction` |
| `occurred_at` | timestamptz | date de l'événement économique (échéance créée, argent reçu) — l'ordre du relevé |
| `due_date` | date, nullable | exigibilité — renseignée pour les débits planifiés, pilote le retard |
| `period_start` / `period_end` | date, nullable | mois couvert (débits `loyer` uniquement, règles ADR-004) |
| `status` | `pending` \| `validated` \| `disputed` \| `withdrawn` | cycle de reconnaissance (voir § 3 et 4) |
| `validated_by` / `validated_at` | `landlord` \| `tenant` \| `system` + timestamptz | qui a rendu la ligne certaine |
| `disputed_at` | timestamptz, nullable | entrée en litige — reste posée après un retrait (deux voix conservées) |
| `reversal_of` | uuid, nullable, FK `transactions` | contre-passation : lien vers la ligne validée corrigée |
| `replaced_by` | uuid, nullable, FK `transactions` | remplacement : lien vers la ligne corrigée réémise |
| `resolution` / `resolved_at` | `retrait_contestation` \| `retrait_auteur` \| `remplacement` + timestamptz | comment la ligne est sortie de `pending`/`disputed` |
| `tenant_token` | uuid unique, nullable | accès public locataire (lignes soumises à sa validation) |
| `contest_nature` / `contested_amount` / `tenant_comment` | `amount` \| `not_owed` \| `already_paid` \| `other` + int + text | version du contestataire — « deux voix », modèle ADR-013 |
| `source` | `genere_par_bail` \| `manuel` \| `feexpay` \| `declaration_locataire` | origine de la ligne |
| `label` | text | libellé lisible (« Réparation serrure ») |
| `legacy_ref` | text unique, nullable | correspondance avec le modèle hérité (backfill idempotent + miroir) — transitoire, tombe à la phase Contract |

### 2. L'échéance ne disparaît pas : elle est absorbée

`Transaction` remplace `rent_dues` et `rent_receptions` **comme tables**, pas
comme concepts. Un retard est un débit dont la `due_date` est dépassée et qui
n'est pas couvert par des crédits : sans lignes de débit datées, ni la vue
des impayés ni le Reminder Engine n'existent.

- Le bail continue de générer les débits `loyer` selon les **6 règles
  d'ADR-004** (clamp du jour, borne `end_date`, unicité
  `(lease_id, period_start)`, jamais de réécriture d'une ligne couverte).
- La cadence J-5 / J-1 / jour J / J+3 / J+10 (`lib/reminders/schedule.ts`)
  et le passage en retard par pg_cron se calculent sur ces débits.
- Ranti-ops (ADR-022) lit les impayés dans le grand livre au lieu de
  `rent_dues` ; le contrat d'interface est inchangé.

### 3. Matrice de validation — qui rend quoi certain

**Principe directeur** (toute la matrice s'en déduit ; tout cas futur doit
s'y ramener) : *une affirmation faite dans son propre intérêt ne devient
jamais certaine seule.* Une ligne n'entre au solde certain que par l'une de
ces quatre voies :

- **(a) un accord préexistant** — le bail signé ;
- **(b) un rail de paiement** — l'argent a transité, le webhook fait foi ;
- **(c) une déclaration contre son propre intérêt** — reconnaître avoir reçu
  de l'argent, ou renoncer à une créance ;
- **(d) la validation par la partie qui subit la ligne.**

| # | Ligne | Créée par | Profite à | Statut initial | Devient certaine par |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Débit `loyer` | système (bail) | bailleur | `validated` (`system`) | **(a)** — le bail vaut accord, pas de re-validation mensuelle |
| 2 | Débit `reparation` / `frais` | bailleur | bailleur | `pending` | **(d)** — validation locataire par lien token |
| 3 | Crédit `feexpay` | webhook | locataire | `validated` (`system`) | **(b)** — le rail fait foi |
| 4 | Crédit cash / MoMo saisi | bailleur | locataire | `validated` (`landlord`) | **(c)** — le bailleur reconnaît avoir reçu ; l'acquittement ADR-013 du reçu reste la sur-couche probante |
| 5 | Crédit déclaré par le locataire (`/confirmer/[token]`) | locataire | locataire | `pending` | **(d)** — validation bailleur (reprend le flux « réception draft » actuel) |
| 6 | Contre-passation d'un **débit** validé | bailleur | locataire | `validated` (`landlord`) | **(c)** — renoncer à une créance joue contre soi |
| 7 | Contre-passation d'un **crédit** validé | bailleur | bailleur | `pending` | **(d)** — « j'ai saisi ce paiement par erreur » augmente la dette du locataire : validation locataire requise. Amende le flux « annuler l'encaissement » d'ADR-005 pour les crédits validés |
| 8 | Contre-passation système (remboursement / reversal FeexPay) | webhook | — | `validated` (`system`) | **(b)** |

Règles transverses :

- **Symétrie des rôles** : la partie habilitée à valider ou contester une
  ligne `pending` est toujours **celle qui la subit** — le locataire pour les
  lignes 2 et 7, le bailleur pour la ligne 5. Personne ne valide sa propre
  affirmation.
- **Pas d'acceptation tacite** : sans clic, une ligne `pending` le reste
  indéfiniment (règle ADR-013 reconduite — aucun statut tacite opposable).
  Elle apparaît dans « en attente », jamais dans le solde certain. Si le
  bailleur veut sortir de l'attente, ses seuls chemins sont le retrait ou la
  relance humaine — pas l'écoulement du temps.
- **Retrait par l'auteur** : une ligne `pending` peut être retirée par la
  partie qui l'a créée (`withdrawn`, `resolution = retrait_auteur`, motif
  obligatoire, `audit_logs`). L'indélébilité ne commence qu'à `validated` ;
  une affirmation jamais reconnue n'a pas besoin de contre-passation pour
  disparaître — mais elle reste lisible dans l'historique.
- **Un canal de contestation par direction** : les débits se contestent sur
  la ligne du grand livre (cette ADR) ; les crédits déjà validés se
  contestent sur le **reçu** qui les matérialise (ADR-013, `tenant_ack`),
  jamais les deux. Un désaccord = un seul lieu de vérité.

### 4. Cycle de vie du litige — machine à états fermée

```txt
                    validation (partie qui subit)
        pending ────────────────────────────────▶ validated   [terminal, indélébile]
           │                                          │
           │ contestation (partie qui subit)          │ seul remède :
           ▼                                          ▼ contre-passation
        disputed                                  (nouvelle ligne, § 3 lignes 6-8)
           │
           ├── retrait de la contestation ──▶ validated  (resolution = retrait_contestation)
           ├── retrait par l'auteur ────────▶ withdrawn  (resolution = retrait_auteur)
           ├── remplacement par l'auteur ───▶ withdrawn  (resolution = remplacement,
           │                                              replaced_by → nouvelle ligne pending)
           └── statu quo ───────────────────▶ reste disputed, documenté, sans expiration
```

**Entrée en litige.** Seule une ligne `pending` peut être contestée, et
seulement par la partie qui la subit. La contestation enregistre sa nature
(`amount` — montant contesté, `not_owed` — dette non reconnue,
`already_paid` — déjà réglé, `other`), le montant reconnu le cas échéant, et
un commentaire libre. La version de l'auteur n'est **jamais écrasée** : les
deux voix coexistent (modèle ADR-013).

**Pendant le litige.** La ligne est hors solde certain, comptée dans
« en litige », visible des deux parties avec ses deux versions. Le bail
porte un indicateur visuel sur le dashboard (pattern ADR-013). L'auteur est
notifié de la contestation (dashboard + WhatsApp via ranti-ops).

**Les quatre sorties** — toutes tracées dans `audit_logs`, toutes notifiées
à l'autre partie :

1. **Retrait de la contestation** : le contestataire revient sur sa
   contestation via son lien token → `validated` (`validated_by` = lui).
   La ligne devient certaine et indélébile.
2. **Retrait par l'auteur** : l'auteur reconnaît que la ligne était
   infondée → `withdrawn`, motif obligatoire. La créance disparaît des
   soldes, l'épisode reste lisible dans l'historique.
3. **Remplacement** : l'auteur corrige (ex. « Réparation serrure — 50 000 »
   → « 5 000 ») → l'ancienne ligne passe `withdrawn`
   (`resolution = remplacement`, `replaced_by` renseigné), la nouvelle
   repart à `pending` avec un **nouveau token** et une nouvelle
   notification. Le cycle de validation recommence à zéro — une correction
   n'hérite jamais de la confiance de la ligne qu'elle remplace.
4. **Statu quo** : aucune des parties ne bouge. La ligne reste `disputed`
   sans limite de durée — Ranti documente le désaccord, ne l'arbitre pas
   (neutralité ADR-013). Le montant reste affiché « en litige » : c'est le
   dossier factuel qu'un médiateur pourra lire.

**Invariants de la machine à états** (imposés en base) :

- `validated` est terminal : aucun `UPDATE` de statut, aucune contestation
  a posteriori sur la ligne. Le seul remède contre une ligne validée est la
  contre-passation (§ 3, lignes 6-8) — qui est elle-même une ligne soumise
  à la matrice.
- `withdrawn` est terminal : une ligne retirée ne revient jamais en jeu ;
  corriger = réémettre (`replaced_by`).
- Toute transition écrit `audit_logs` dans la même transaction (ADR-006) et
  pose `resolution` / `resolved_at` quand elle sort de `pending`/`disputed`.

### 5. Indélébilité et contre-passation

- Une ligne `validated` est **indélébile** : `UPDATE` et `DELETE` refusés
  par trigger en base (pas seulement dans le code applicatif).
- Toute correction d'une ligne validée est une **contre-passation** : ligne
  inverse de type `contre_passation`, `reversal_of` pointant l'origine,
  motif obligatoire (règle ADR-005 : « on ne supprime pas l'histoire, on
  ajoute un événement correctif »). L'erreur et sa correction restent toutes
  deux lisibles — c'est ce qui fonde la valeur probante du registre.
- La contre-passation suit elle-même la matrice (§ 3) : certaine d'emblée
  quand elle joue contre son auteur (ligne 6), soumise à validation quand
  elle le sert (ligne 7).

### 6. Solde dynamique — trois nombres, jamais fusionnés

Vue `lease_balances`, calculée en base (jamais de solde stocké à la main).
Les lignes `withdrawn` n'entrent dans aucun agrégat :

| Nombre | Formule | Sens |
| :-- | :-- | :-- |
| **Solde certain** | Σ crédits `validated` − Σ débits `validated` | ce que les deux parties (ou le rail) reconnaissent |
| **En attente** | Σ lignes `pending` (par direction) | affirmé, pas encore reconnu |
| **En litige** | Σ lignes `disputed` (par direction) | désaccord documenté |
| **Impayé** | débits `validated` à `due_date` échue non couverts | pilote le dashboard et les relances |

Un montant `pending` ou `disputed` n'entre **jamais** dans le solde certain :
mélanger l'affirmé et le reconnu détruirait la confiance que le produit vend.

Règle d'exigibilité : un débit sans `due_date` (réparation, frais) est dû
tout de suite ; une **contre-passation hérite de l'exigibilité de sa cible**
— annuler une échéance future ne réduit pas l'impayé du jour, annuler un
encaissement le ré-augmente immédiatement.

### 7. Surface locataire : liens signés, pas de compte

Reconduction du modèle ADR-013, qui a fait ses preuves sur le reçu :

- lien public `/transaction/[token]` (`tenant_token` par ligne soumise à
  validation), RPC `SECURITY DEFINER` pour lire / valider / contester /
  retirer sa contestation — `anon` n'accède à aucune table en direct ;
- notification par **WhatsApp via ranti-ops** (rail ADR-022) à chaque
  événement du cycle : création d'une ligne `pending`, contestation,
  sortie de litige — message conforme à la voix de marque, avec le lien
  signé ;
- aucun compte locataire imposé : la friction tuerait le taux de validation,
  qui est la métrique de survie du pivot.

### 8. Interface propriétaire

Le dashboard bascule du « nombre de reçus émis » à la **vue des impayés et
des soldes** : qui est en retard, de combien, qu'est-ce qui est en attente,
qu'est-ce qui est en litige. Tout ce qui n'est pas lié à la clarté du solde
ou à la validation des dettes est secondaire pour l'instant.

### 9. Le Proof Engine survit comme sortie du grand livre

`receipts`, l'acquittement ADR-013 et la génération automatique (ADR-007)
sont conservés : la quittance est émise quand les débits `loyer` d'une
période sont soldés par des crédits validés. Prudence de discours maintenue :
la valeur juridique établie est celle de la quittance ; la ligne validée la
renforce, elle ne la remplace pas. C'est le couple *grand livre + quittance*
qui est opposable devant un médiateur.

## Transition — expand-and-contract, quatre phases

1. **Docs d'abord** : cette ADR, puis `vision.md`, `architecture.md`,
   `domain-model.md`, `database.md` mis à jour avant toute migration.
2. **Expand** (livrée) : table `transactions` + vue `lease_balances` à côté
   de l'existant, backfill idempotent (clé `legacy_ref`), et miroir par
   **triggers en base** sur les tables héritées — pas de double écriture
   applicative : les RPC SQL (`generate_rent_dues`,
   `verify_payment_transaction`, chemins ops) sont couvertes d'office, dans
   la même transaction Postgres. Granularité transitoire : une ligne de
   crédit par allocation (projection fidèle du modèle hérité) ; l'argent
   confirmé non affecté (fast-log ADR-014) reste au journal, hors grand
   livre par bail. Aucun changement UI tant que les soldes recalculés ne
   collent pas à 100 % avec l'existant (garde
   `private.verify_ledger_equality()`, exécutée dès la migration — un écart
   la fait échouer).

   Correspondance de backfill (statuts dérivés de la matrice § 3) :

   | Donnée existante | Ligne créée | Statut |
   | :-- | :-- | :-- |
   | `rent_dues` (toutes, y compris `overdue`) | débit `loyer`, `source = genere_par_bail` | `validated` (`system`) — matrice ligne 1 |
   | `rent_dues` annulées ou archivées | débit **+** contre-passation (motif repris) | paire `validated` — l'histoire n'est pas réécrite |
   | `rent_receptions` confirmées (via allocations) | crédit `reglement`, `source = manuel` ou `feexpay` | `validated` (`landlord` ou `system`) — lignes 3-4 |
   | `rent_receptions` `draft` (déclarations `/confirmer`) | crédit `reglement`, `source = declaration_locataire` | `pending` — ligne 5 |
   | `rent_receptions` confirmées puis annulées (ADR-005) | crédit `validated` **+** contre-passation `validated` (motif repris) | paire ligne 4 + ligne 6/7 — l'histoire n'est pas réécrite |
   | `rent_receptions` `draft` annulées | crédit `withdrawn` (`retrait_auteur`) | jamais devenu certain — pas de contre-passation |

   Note sur la matrice ligne 7 pendant l'Expand : le miroir suit la vérité
   héritée — l'annulation d'un encaissement confirmé (flux ADR-005 actuel)
   se projette en contre-passation `validated`. L'exigence de validation
   locataire de la ligne 7 s'applique à partir de la bascule, quand le flux
   locataire existe.

3. **Nouvelle lecture** (livrée) : le dashboard bascule sur `lease_balances`
   (impayés & soldes) via `lib/ledger` — une ligne par bail, dette consolidée
   en compte courant (une avance réduit le dû ; un même locataire n'apparaît
   plus une fois par échéance), tuile « Retard » sourcée du grand livre,
   déclarations à confirmer et litiges visibles par bail. « Payé / Attendu »
   et le taux de recouvrement restent des lentilles mensuelles sur
   `rent_due_balances` (déjà lue pour la cadence ADR-022) — la vue par bail
   n'a pas de découpage mensuel, et le rapprochement paiement↔mois est un
   concept d'allocation hérité, pas de compte courant. Premier bénéfice
   visible, sans flux locataire.

   Règles d'affichage (dérivées du § 6) : le chiffre rouge d'une ligne est
   l'**impayé seul** — la somme des lignes rouges recolle avec la tuile
   « Retard » ; l'« attendu » est nommé dans la sous-ligne, jamais fusionné ;
   un montant en simple attente (déclaration) s'affiche en ton neutre, une
   attente n'étant pas une dette ; « à jour » signifie désormais *bail actif
   sans dû, sans attente, sans litige* (compte courant), plus « échéances du
   mois soldées ».

   Limites connues de la coexistence des lentilles (assumées jusqu'aux
   phases suivantes) : les **relances** (ADR-022) et la **fiche bail**
   restent calculées par échéance (`rent_due_balances`) — un crédit affecté
   par le bailleur à un mois futur alors qu'un mois ancien reste dû peut
   donc produire un écart visible (liste « aucun retard » côté compte
   courant, relance de retard côté cadence). Les relances affichent ce que
   ranti-ops enverra réellement (leçon ADR-022 : l'UI ne promet que ce qui
   est vrai) ; la réconciliation des lentilles se fait à la bascule de la
   fiche bail et de la source des relances sur le grand livre.
4. **Le différenciant** (livré côté produit) : débits variables par RPC
   (`add_lease_charge` — la charge naît `pending` avec son `tenant_token`),
   retrait et remplacement par le bailleur (`withdraw_ledger_line` /
   `replace_ledger_charge`, motifs tracés dans `audit_logs`, nouveau token à
   chaque réémission), page publique `/transaction/[token]` (valider,
   contester en quatre natures, retirer sa contestation — décalque ADR-013),
   section « Charges & frais » sur la fiche bail. Notification WhatsApp en
   deux temps : le **filet manuel wa.me** est dans la fiche bail dès
   aujourd'hui (le propriétaire relit et envoie — doctrine ADR-006 MVP) ;
   l'envoi automatisé est le rail **ranti-ops** via la vue
   `ops_ledger_notifications` (contrat ADR-022 reconduit — le branchement
   cockpit reste à faire côté ranti-ops). Les triggers d'indélébilité et la
   contre-passation étaient livrés dès l'Expand.
5. **Contract** : lectures 100 % sur `transactions` ; `rent_dues` /
   `rent_receptions` gelées en lecture seule pendant au moins un cycle de
   loyer complet avant toute dépréciation — aucune donnée financière n'est
   supprimée.

Chaque phase livre de la valeur seule : si le terrain invalide le flux
locataire (le pari le plus risqué), les phases 2–3 restent acquises — un
vrai ledger et un meilleur dashboard d'impayés.

## Alternatives considérées

- **Statu quo (reçu comme cœur)** : rejeté — le terrain montre que le reçu
  est la conséquence, pas le problème ; les charges variables et les litiges
  restent hors système, donc sur WhatsApp.
- **Big-bang** (remplacer les tables d'un coup) : rejeté — données
  financières en production, Reminder Engine et Proof Engine branchés sur le
  schéma actuel ; l'expand-and-contract permet de vérifier l'égalité des
  soldes avant toute bascule.
- **Comptes locataires authentifiés** : rejeté pour l'instant — friction
  incompatible avec le taux de validation recherché ; le modèle token
  d'ADR-013 fait le même travail. Réouvrable si le terrain demande un espace
  locataire persistant.
- **Acceptation tacite des débits** (validé après N jours sans réponse) :
  rejeté — aucun statut tacite opposable (cohérence ADR-013) ; un solde
  « certain » gonflé de silences ne serait certain que de nom.
- **Contestation possible sur les lignes validées** : rejeté — `validated`
  doit rester terminal pour que « indélébile » veuille dire quelque chose ;
  le désaccord tardif passe par le reçu (ADR-013) ou par une demande de
  contre-passation, jamais par la réouverture d'une ligne certaine.
- **Correction par édition des lignes `pending`** : rejeté — même une ligne
  non validée ne s'édite pas ; on retire et on réémet (`replaced_by`), pour
  que le locataire notifié ne voie jamais une ligne changer sous ses yeux.

## Conséquences

- Migrations : table `transactions` + contraintes (montant positif,
  cohérence type/direction/statut, `reversal_of` vers ligne validée
  uniquement, `replaced_by`), vue `lease_balances`, triggers d'indélébilité
  et de terminalité (`validated`, `withdrawn`), triggers miroir des tables
  héritées, backfill idempotent selon la correspondance § Transition, garde
  d'égalité — **livré** (`20260716150000_ledger_transactions_expand.sql`,
  testé par `supabase/tests/ledger_transactions.test.sql`). RPC token
  locataire : phase « différenciant ».
- `lib/` : module `ledger` **livré** (types `LeaseBalance`, query
  `getLandlordLeaseBalances`, agrégation pure `buildLedgerOverview` — dérive
  l'« attendu » du solde certain : `attendu = max(0, −solde) − impayé`) ;
  les écritures n'ont pas besoin de changer — le miroir vit en base.
- Docs à mettre à jour dans la foulée : `vision.md` (promesse : les cinq
  questions deviennent « quel est le solde, qu'est-ce qui est reconnu,
  qu'est-ce qui est contesté »), `architecture.md` (domaine central),
  `domain-model.md`, `database.md`, `glossary.md`.
- Métrique de survie du pivot : **taux de validation locataire** des débits
  variables — si les locataires ne cliquent pas, l'arbitre digital n'existe
  pas.

## Hors périmètre

- Médiation / résolution des litiges (Ranti documente, ne tranche pas).
- Prorata automatique des périodes partielles (règle MVP ADR-004 reconduite).
- Pénalités de retard, intérêts, dépôt de garantie comme types de ligne
  (types futurs possibles du grand livre, non engagés).
- Multi-devises (FCFA uniquement).
- Relance automatique des validations `pending` restées sans réponse
  (chantier possible côté ranti-ops, non engagé).

## Critères de réouverture

- Le taux de validation locataire reste marginal après un cycle complet de
  pilote → revoir le canal (WhatsApp interactif, USSD) ou le modèle de
  validation.
- Le volume de litiges non résolus devient significatif → chantier
  médiation/résolution, aujourd'hui hors périmètre.
- Le terrain demande un espace locataire persistant → réévaluer les comptes
  locataires (alternative rejetée ci-dessus).
- La règle « pas d'acceptation tacite » laisse trop de lignes `pending`
  orphelines pour que le solde certain reste utile → réévaluer un mécanisme
  de rappel de validation (jamais une validation tacite).
