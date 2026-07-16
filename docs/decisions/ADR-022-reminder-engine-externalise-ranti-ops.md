# ADR-022 — Reminder Engine : l'envoi vit dans ranti-ops (externalisation assumée)

## Statut

Accepté (2026-07-16, décision CEO — issue #165, option A). Supersède la partie
« envoi » d'ADR-006 côté app ; la partie « cadence née du bail et des
échéances » d'ADR-006 reste pleinement valable.

## Contexte

L'audit du 2026-07-16 (critique produit/design) a montré un écart entre ce que
l'UI promet et ce que ce dépôt exécute :

- Le dashboard affiche « Relances à venir » avec « Ranti s'en charge
  automatiquement — vous n'avez rien à envoyer », et la fiche bail le
  calendrier J-5 / J-1 / jour J / J+3 / J+10.
- Le cron SMS de ce dépôt (`/api/cron/reminders`, Vercel Cron quotidien) était
  **dormant** (`REMINDERS_SMS_ENABLED` jamais posé) : la table `reminders`
  (canal SMS) compte 0 ligne depuis toujours.
- L'envoi réel est opéré par **ranti-ops** (cockpit opérateur, dépôt séparé)
  sur le canal **WhatsApp**, et trace chaque envoi dans `reminder_events`
  (3 envois live au moment de la décision, dernier le 2026-07-06).
- Le code dormant portait un bug latent documenté dans ses propres
  commentaires : activé tel quel, il enverrait SMS **et** WhatsApp au même
  locataire (aucun cross-dedup avec `reminder_events`).

Deux options étaient posées (issue #165) : assumer l'externalisation (A) ou
rapatrier le moteur (B). Le statu quo — une UI qui promet, un dépôt qui dort —
était exclu.

## Décision

**Option A : ranti-ops est le moteur d'envoi officiel des relances.**

### Contrat d'interface (qui fait quoi)

| Responsabilité | Où | Quoi |
|---|---|---|
| Échéances & retards | ce dépôt (DB) | `rent_dues` ; passage `expected → overdue` par pg_cron (`mark_all_overdue_rent_dues`, migration 011) — indépendant de l'envoi |
| Cadence de référence | ce dépôt | J-5 / J-1 / jour J / J+3 / J+10 (`lib/reminders/schedule.ts`, affichée sur le dashboard et la fiche bail) |
| **Envoi** | **ranti-ops** | WhatsApp, à partir des échéances impayées lues en base |
| Trace des envois | ranti-ops → DB | `reminder_events` (insert par service_role ; lisible par le propriétaire, RLS) |
| Affichage des envois | ce dépôt | `/reminders` et la fiche bail lisent `reminders` ∪ `reminder_events` (`lib/reminders/queries.ts`) |

- Le message reste conforme aux contraintes de marque (voix « vous », ton
  calme) et contient le lien `/confirmer/[token]`.
- **Panne = silence détectable** : si ranti-ops n'envoie plus, `reminder_events`
  cesse de croître alors que des échéances impayées passent leurs fenêtres —
  vérifiable d'une requête. La surveillance opérationnelle de ce signal
  appartient à ranti-ops (cockpit) ; ce dépôt n'alerte pas au MVP.
- Le filet manuel reste dans ce dépôt : bouton « Relancer sur WhatsApp »
  (wa.me pré-rempli) sur la fiche bail (#163) — le propriétaire garde la main
  (Principe 12).

### Conséquences dans ce dépôt

1. **Le chemin SMS mort est supprimé** (code non exécuté = bug latent) :
   route `/api/cron/reminders`, `vercel.json` (cron quotidien),
   `lib/reminders/sms.ts` (templates GSM-7 + client Africa's Talking) et son
   test. Git garde l'historique ; un futur canal SMS repartirait de zéro AVEC
   le cross-dedup `reminder_events` comme prérequis (le bug latent documenté).
2. **Le schéma ne bouge pas** : la table `reminders` (migration 018) reste —
   historique + les lectures d'UI l'unionnent avec `reminder_events`. Les
   colonnes de planification `rent_dues.last_reminder_at` / `next_reminder_at`
   / `reminder_count` restent en base, dormantes (documenté dans database.md).
3. **Le wording UI est désormais vrai** : « Ranti s'en charge automatiquement »
   est adossé à un envoi réel de bout en bout (ranti-ops). La projection
   « Relances à venir » (dashboard) et le calendrier (fiche bail) restent la
   cadence de référence que ranti-ops applique.
4. `/conditions` §6 ne promet plus de réglage futur non engagé : les chemins
   réels (terminer le bail ; demander la suspension via le contact) suffisent.

## Alternatives considérées

- **Option B — rapatrier l'envoi dans ce dépôt** : exigeait un provider SMS
  contractualisé (coût par segment), le cross-dedup avec `reminder_events`,
  un monitoring des échecs et l'opt-out par bail. Rien de tout cela n'est
  justifié tant que le canal WhatsApp opéré couvre le pilote. Reste possible
  plus tard ; cette ADR devra alors être supersédée.
- **Statu quo** : rejeté — l'écart promesse/réalité est une dette de confiance
  directe contre la boussole « fiable / sérieux ».

## Critères de réouverture

- Le pilote dépasse ce que le cockpit opérateur peut envoyer à la main / en
  semi-automatique (signal d'échelle).
- WhatsApp devient inopérant (bannissement, coût API) → canal SMS à
  reconstruire, dans ce dépôt ou dans ranti-ops, avec cross-dedup.
- Le terrain demande des règles de relance par bail (`lease_reminder_rules`,
  database.md) : la configuration naîtrait ici, l'envoi resterait contractuel.
