# ADR-013 — Contestation locataire & statuts probants du reçu

## Statut

Accepté (implémenté 2026-07-11).

## Contexte

Ranti veut documenter l'état réel de la relation bailleur/locataire sur chaque
reçu, sans trancher les litiges : un reçu peut être une simple déclaration du
bailleur, ou validé par le locataire, ou contesté. Objectif = valeur de preuve
graduée, neutre, opposable devant un médiateur.

Deux flux existants à ne pas confondre :

- **Déclaration locataire pré-paiement** (`/confirmer/[token]`, token sur
  `rent_dues.confirmation_token`) : le locataire signale « j'ai payé » AVANT
  que le bailleur ne confirme. Débouche sur une réception `draft`.
- **ADR-005 — correction par remplacement** : le **bailleur** corrige SA
  déclaration en remplaçant le document (l'historique est préservé).

La contestation visée ici est **un troisième acte, distinct** : le
**locataire** valide ou conteste un **reçu déjà émis** par le bailleur. Elle
opère sur `receipts` (après émission), pas sur l'échéance, et ne remplace pas
ADR-005 (acteurs et moments différents).

Aujourd'hui `receipts.status` ne connaît que `issued` / `cancelled` (cycle de
vie du document) et les reçus ne sont atteignables par aucun lien public.

## Décision

Ajouter au reçu un **cycle d'acquittement locataire** parallèle au cycle de vie
`issued/cancelled`, et un point d'accès public par token.

### 1. Statut d'acquittement (colonne dédiée, pas de surcharge de `status`)

Nouvelle colonne `receipts.tenant_ack` :

| Valeur | Sens | Déclencheur |
| :-- | :-- | :-- |
| `unilateral` | Déclaration unilatérale du bailleur | à l'émission (défaut) |
| `read` | Reçu ouvert par le locataire | 1re ouverture du lien |
| `certified` | Locataire a confirmé l'exactitude | clic « Confirmer » |
| `disputed` | Locataire conteste | clic « Contester » |

`status` (`issued`/`cancelled`) reste **inchangé** : le cycle de vie du document
et l'acquittement locataire sont deux dimensions orthogonales.

### 2. Accès public par token

- `receipts.tenant_token uuid unique default gen_random_uuid()`.
- Nouvelle route publique `/(public)/recu/[token]`.
- RPC `SECURITY DEFINER`, clés sur le token, `anon`/`authenticated` :
  - `get_receipt_by_token` : lit le reçu ; si `tenant_ack = 'unilateral'`, le
    passe à `read` et pose `tenant_read_at` (première ouverture).
  - `certify_receipt_by_token` : `read`/`unilateral` → `certified`, pose
    `tenant_certified_at` et l'empreinte `sha256_fingerprint`.
  - `contest_receipt_by_token` : → `disputed`, enregistre la version du
    locataire.
- L'`anon` n'accède à aucune table en direct (même modèle qu'ADR sur
  `/confirmer`).

### 3. Colonnes de contestation (deux voix, isolées)

Sur `receipts` : `tenant_read_at`, `tenant_certified_at`, `contested_at`,
`contest_nature` (`amount` | `date` | `not_paid`), `contested_amount int`,
`contested_period text`. La déclaration du bailleur n'est jamais écrasée ; la
version du locataire est stockée à part → PDF « deux voix ».

### 4. SHA-256 = intégrité, pas identité

`sha256_fingerprint` rempli à la certification, sur le contenu figé du reçu.
Il garantit que le document n'a pas été altéré, **pas** l'identité du cliqueur.
Aucune formule « preuve irréfutable » : mentions strictement factuelles.

## Règles

- **Pas d'acceptation tacite à valeur juridique.** Passé un délai sans clic,
  le reçu reste `read` (indicateur produit). Aucun statut « tacite » opposable
  (cohérent avec la reformulation légale actée précédemment).
- **Coexistence ADR-005.** Un remplacement (`replace_receipt`) crée un nouveau
  reçu : nouveau `tenant_token`, `tenant_ack` réinitialisé à `unilateral`. Le
  reçu remplacé garde son dernier état d'acquittement dans l'historique.
- **Contestation non destructive.** `disputed` ne bloque ni ne supprime le
  reçu ; il reste téléchargeable par les deux parties, bandeau rouge, deux
  versions côte à côte.
- **Neutralité.** Ranti documente le désaccord, n'arbitre pas.

## Conséquences

- **Migration** : colonnes `tenant_ack` (+ contrainte), `tenant_token`,
  timestamps, colonnes de contestation, `sha256_fingerprint` ; 3 RPC
  `SECURITY DEFINER` + grants ; index sur `tenant_token`.
- **UI publique** : `/recu/[token]` (récap + boutons Confirmer/Contester +
  formulaire de nature + notice APDP).
- **PDF** : rendu conditionnel selon `tenant_ack` (bandeau jaune/gris/vert/rouge,
  deux voix si `disputed`, empreinte si `certified`).
- **Dashboard** : ligne du bail en orange si un reçu est `disputed`.
- Le lien de partage passe désormais par `/recu/[token]` (à générer après
  émission et à joindre au message WhatsApp du bailleur).

## Hors périmètre

- Médiation / résolution du litige (Ranti ne tranche pas).
- Notification automatique du bailleur à la contestation au-delà de
  l'affichage dashboard (relance = chantier C).
