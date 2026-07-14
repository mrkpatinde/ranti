# ADR-017 — Notifications de paiement côté serveur (au lieu de lire les SMS)

## Statut

Proposé (2026-07-12). Direction validée par le CEO ; implémentation par étapes,
dépend de l'accès aux API opérateurs. ADR-018 (2026-07-14) implémente ce
modèle pour le rail Kkiapay : webhook signé → ingestion seule, la validation
humaine du propriétaire reste obligatoire avant toute écriture de réception.

## Contexte

Le propriétaire demande que Ranti « lise directement les SMS » de paiement
Mobile Money au lieu de les coller. Contrainte technique dure :

- **Une app web / PWA ne peut PAS lire la boîte SMS.** iOS n'expose aucune API.
  Android Chrome n'expose que la Web OTP API (codes à usage unique contenant le
  domaine), inutilisable pour un SMS MoMo arbitraire.
- Une **app Android native** avec `READ_SMS` est refusée par la Play policy hors
  application SMS par défaut ; iOS reste impossible.

Le collage manuel (ADR-014) reste donc le seul chemin universel côté client et
doit être conservé comme filet.

## Décision

Ne pas lire le téléphone. **Recevoir l'événement de paiement côté serveur**,
directement de l'opérateur / du rail de paiement, via webhook.

1. Endpoint d'ingestion `POST /api/payments/notification` (par fournisseur),
   authentifié par signature du fournisseur (HMAC / clé partagée), idempotent
   sur la référence de transaction.
2. La charge utile (montant, émetteur, référence, horodatage) est normalisée
   puis **passe par le pipeline existant** : résolution vers un bail via le
   portefeuille (Gemini/heuristique, comme le collage SMS) → **carte de
   validation** → `record_collection` → `confirm_collection` →
   `generate_receipt`. Aucun chemin d'écriture parallèle.
3. **La confirmation humaine reste obligatoire** (ADR-012/013) : la notification
   pré-remplit, le propriétaire valide, la quittance est la conséquence de la
   confirmation. Une notification n'écrit jamais seule en base.

### « Comment savoir lequel est le bon »

Même logique que le collage : filtrer les notifications de paiement, extraire
montant/émetteur/référence, résoudre vers un bail actif du portefeuille, et si
le nom/montant ne recoupe pas un bail avec certitude → basculer en choix manuel
(réutilise le garde-fou `hintMatchesTenant`, ADR-012). Déduplication par
référence de transaction.

## Fournisseurs (par ordre de priorité, à confirmer selon l'accès)

| Rail | Réception notif | Note |
|------|-----------------|------|
| **MTN MoMo Collections** (Bénin, live 28/06/2026) | Callback/webhook du produit Collection | Plus grande base Bénin ; nécessite compte marchand + API user |
| **Wave Business API** | Webhooks paiement | API documentée, à valider Bénin |
| **PI-SPI RTP Business** | Notification de virement reçu | Aligné roadmap Q4 ; recevoir ≠ initier |
| **Moov Money** | À évaluer | Couverture à confirmer |

## Périmètre agrément

**Recevoir** une notification de paiement (le propriétaire est le bénéficiaire)
n'est pas de l'**initiation** de paiement : le déclencheur BCEAO Tier 2
(agrément établissement de paiement) porte sur l'initiation, pas sur la simple
réception d'un événement de crédit sur un compte marchand du propriétaire. À
confirmer juridiquement fournisseur par fournisseur avant mise en production.

## Conséquences

- Vrai « lire direct » sans toucher le téléphone ni l'argent.
- Marche sur iOS comme Android (traitement serveur).
- Dépendance à l'onboarding marchand de chaque opérateur (friction déplacée du
  copier-coller vers une configuration unique).
- Le collage SMS (ADR-014) reste le filet universel tant que tous les
  propriétaires n'ont pas de rail connecté.

## Hors périmètre (cet ADR)

- L'initiation de paiement / le prélèvement (Tier 2, agrément BCEAO).
- Le renvoi de SMS Android → webhook (interim possible, non retenu comme cible).
