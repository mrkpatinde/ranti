# ADR-023 — Grand Livre de Confiance : le compte courant locatif devient le cœur du système

## Statut

Accepté (2026-07-16, décision CEO — pivot stratégique « Grand Livre de
Confiance »).

Positionnement vis-à-vis des ADR existantes :

- **Amende ADR-004** : les règles de génération des échéances restent
  intégralement valables ; leur cible devient une ligne de débit du grand
  livre au lieu d'une table dédiée (voir § Décision 2).
- **Généralise ADR-005 et ADR-013** : la correction par événement correctif
  et le cycle Valider/Contester par lien token, aujourd'hui limités au reçu,
  deviennent les mécanismes de toute ligne du grand livre.
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
| `due_date` | date, nullable | exigibilité — renseignée pour les débits planifiés, pilote le retard |
| `period_start` / `period_end` | date, nullable | mois couvert (débits `loyer` uniquement, règles ADR-004) |
| `status` | `pending` \| `validated` \| `disputed` | cycle de validation (voir § 3) |
| `validated_by` / `validated_at` | `landlord` \| `tenant` \| `system` + timestamptz | qui a rendu la ligne certaine |
| `reversal_of` | uuid, nullable, FK `transactions` | contre-passation : lien vers la ligne corrigée |
| `source` | `genere_par_bail` \| `manuel` \| `feexpay` \| `declaration_locataire` | origine de la ligne |
| `label` | text | libellé lisible (« Réparation serrure ») |

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

### 3. Cycle de validation et matrice des rôles

Le statut initial d'une ligne dépend de qui l'affirme et sur quel fondement :

| Ligne | Créée par | Statut initial | Justification |
| :-- | :-- | :-- | :-- |
| Débit `loyer` | système (bail) | `validated` (`system`) | le bail signé vaut accord — pas de re-validation mensuelle |
| Débit `reparation` / `frais` | propriétaire | `pending` | affirmation unilatérale → le locataire doit se prononcer |
| Crédit `feexpay` | webhook | `validated` (`system`) | le rail de paiement fait foi |
| Crédit cash / MoMo saisi | propriétaire | `validated` (`landlord`) | déclaration du bailleur, comme aujourd'hui ; l'acquittement locataire ADR-013 reste la sur-couche probante |
| Contre-passation | propriétaire | `validated` | correction assumée, tracée, visible des deux parties |

Transitions depuis `pending` (débits variables) :

- locataire clique **Valider** → `validated` (`tenant`) — la dette devient
  certaine et indélébile ;
- locataire clique **Contester** → `disputed`, avec nature et version du
  locataire enregistrées (mêmes champs « deux voix » qu'ADR-013) ;
- **pas d'acceptation tacite** : sans clic, la ligne reste `pending`
  indéfiniment (règle ADR-013 reconduite — aucun statut tacite opposable).

Sorties de `disputed` — Ranti documente, ne tranche pas (neutralité ADR-013) :

- le propriétaire contre-passe la ligne (il renonce ou corrige) ;
- le locataire retire sa contestation → `validated` (`tenant`) ;
- sinon la ligne reste `disputed`, visible des deux parties, hors solde
  certain.

### 4. Indélébilité et contre-passation

- Une ligne `validated` est **indélébile** : `UPDATE` et `DELETE` refusés
  par trigger en base (pas seulement dans le code applicatif).
- Toute correction est une **contre-passation** : ligne inverse de type
  `contre_passation`, `reversal_of` pointant l'origine, motif obligatoire
  (règle ADR-005 : « on ne supprime pas l'histoire, on ajoute un événement
  correctif »). L'erreur et sa correction restent toutes deux lisibles —
  c'est ce qui fonde la valeur probante du registre.
- Chaque création/validation/contestation/contre-passation écrit un
  `audit_logs` dans la même transaction (ADR-006).

### 5. Solde dynamique — trois nombres, jamais fusionnés

Vue `lease_balances`, calculée en base (jamais de solde stocké à la main) :

| Nombre | Formule | Sens |
| :-- | :-- | :-- |
| **Solde certain** | Σ crédits validés − Σ débits validés | ce que les deux parties (ou le rail) reconnaissent |
| **En attente** | Σ débits `pending` | affirmé par le bailleur, pas encore reconnu |
| **En litige** | Σ débits `disputed` | désaccord documenté |
| **Impayé** | débits validés à `due_date` échue non couverts | pilote le dashboard et les relances |

Un montant `pending` ou `disputed` n'entre **jamais** dans le solde certain :
mélanger l'affirmé et le reconnu détruirait la confiance que le produit vend.

### 6. Surface locataire : liens signés, pas de compte

Reconduction du modèle ADR-013, qui a fait ses preuves sur le reçu :

- lien public `/transaction/[token]` (token uuid par ligne `pending`), RPC
  `SECURITY DEFINER` pour lire / valider / contester — `anon` n'accède à
  aucune table en direct ;
- notification du locataire par **WhatsApp via ranti-ops** (rail ADR-022),
  message conforme à la voix de marque, avec le lien signé ;
- aucun compte locataire imposé : la friction tuerait le taux de validation,
  qui est la métrique de survie du pivot.

### 7. Interface propriétaire

Le dashboard bascule du « nombre de reçus émis » à la **vue des impayés et
des soldes** : qui est en retard, de combien, qu'est-ce qui est en litige.
Tout ce qui n'est pas lié à la clarté du solde ou à la validation des dettes
est secondaire pour l'instant.

### 8. Le Proof Engine survit comme sortie du grand livre

`receipts`, l'acquittement ADR-013 et la génération automatique (ADR-007)
sont conservés : la quittance est émise quand les débits `loyer` d'une
période sont soldés par des crédits validés. Prudence de discours maintenue :
la valeur juridique établie est celle de la quittance ; la ligne validée la
renforce, elle ne la remplace pas. C'est le couple *grand livre + quittance*
qui est opposable devant un médiateur.

## Transition — expand-and-contract, quatre phases

1. **Docs d'abord** : cette ADR, puis `vision.md`, `architecture.md`,
   `domain-model.md`, `database.md` mis à jour avant toute migration.
2. **Expand** : table `transactions` + vue `lease_balances` à côté de
   l'existant. Backfill : chaque `rent_due` → débit `loyer` validé ; chaque
   `rent_reception` (via ses allocations) → crédit `reglement` validé.
   Double écriture dans les server actions (`rent-dues`, `payments`,
   `collections`). Aucun changement UI tant que les soldes recalculés ne
   collent pas à 100 % avec l'existant.
3. **Nouvelle lecture** : le dashboard bascule sur `lease_balances`
   (impayés & soldes). Premier bénéfice visible, sans flux locataire.
4. **Le différenciant** : débits variables, notification WhatsApp,
   Valider/Contester par lien signé, triggers d'indélébilité,
   contre-passation.
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

## Conséquences

- Migrations : table `transactions` + contraintes (montant positif,
  cohérence type/direction, `reversal_of`), vue `lease_balances`, triggers
  d'indélébilité, RPC token locataire, backfill idempotent.
- `lib/` : nouveau module `ledger` ; `rent-dues`, `payments`, `collections`,
  `receipts`, `reminders` passent en double écriture puis en lecture ledger.
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

## Critères de réouverture

- Le taux de validation locataire reste marginal après un cycle complet de
  pilote → revoir le canal (WhatsApp interactif, USSD) ou le modèle de
  validation.
- Le volume de litiges non résolus devient significatif → chantier
  médiation/résolution, aujourd'hui hors périmètre.
- Le terrain demande un espace locataire persistant → réévaluer les comptes
  locataires (alternative rejetée ci-dessus).
