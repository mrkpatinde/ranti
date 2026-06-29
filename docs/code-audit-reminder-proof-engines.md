# Ranti — Code Audit : Reminder Engine et Proof Engine

## Statut

Version 0.1 — audit code sans modification applicative.

Date : 2026-06-29.

## Objectif

Comparer le code actuel avec la cible documentaire :

- Reminder Engine : rappels et relances à partir du bail et des échéances.
- Proof Engine : génération automatique du document après validation du paiement.

Cet audit ne modifie aucun fichier applicatif.

## Verdict court

Le Proof Engine existe partiellement et solidement côté DB/RPC, mais il n'est pas encore orchestré automatiquement après confirmation côté UI/actions.

Le Reminder Engine n'est pas encore implémenté comme moteur produit. La DB live contient une table `reminders`, mais le code applicatif audité ne contient pas encore de module `reminders` ni de génération depuis règles de bail.

Le dashboard est avancé pour les échéances et encaissements, mais ne consomme pas encore les relances ni les documents générés récemment.

---

# 1. Proof Engine

## État actuel

### Côté action serveur

`apps/web/src/lib/collections/actions.ts` :

- `recordCollection` crée une réception via RPC `record_collection` ;
- puis appelle `confirm_collection` ;
- puis redirige vers `/collections?notice=collection_confirmed` ;
- aucun appel automatique à `generate_receipt` n'est fait dans ce flow.

`confirmCollection` appelle seulement `confirm_collection`, puis redirige vers `/collections?notice=collection_confirmed`.

### Côté génération document

`apps/web/src/lib/receipts/actions.ts` contient `generateReceipt`.

Cette action :

- prend `reception_id` ;
- appelle RPC `generate_receipt` ;
- redirige vers `/receipts/{receiptId}?notice=receipt_generated`.

Donc aujourd'hui, la génération document est une action séparée.

### Côté UI collections

`apps/web/src/app/(app)/collections/page.tsx` :

- charge les encaissements ;
- charge les reçus ;
- mappe `receiptByReception` ;
- pour un encaissement confirmé avec document actif, affiche `Voir le document` ;
- pour un encaissement confirmé sans document, affiche un formulaire `Générer la quittance ou le reçu`.

Conclusion : le produit sait générer un document, mais l'utilisateur doit encore cliquer.

## État DB/RPC

`supabase/migrations/20260628160000_receipt_correction_flows.sql` remplace `generate_receipt`.

La RPC :

- refuse les réceptions non confirmées ;
- renvoie le document actif existant si déjà généré ;
- utilise un advisory lock pour la numérotation ;
- choisit `quittance` si toutes les échéances allouées sont `paid` ;
- sinon choisit `receipt` ;
- crée un snapshot ;
- insère dans `receipts` avec `kind` et `snapshot`.

## Écart avec la cible

| Sujet | État actuel | Cible | Écart |
|---|---|---|---|
| Génération après confirmation | manuelle via bouton | automatique après validation | majeur mais localisé |
| Distinction reçu/quittance | existe via `kind` | reçu partiel / reçu complet / quittance | partiel |
| Snapshot | existe | requis | aligné |
| Idempotence | RPC idempotente sur document actif | requis | aligné |
| Remplacement | RPC `replace_receipt` existe | requis | partiel, audit TODO |
| Annulation encaissement avec document | bloquée côté action si document actif | requis | aligné |

## Décision recommandée

Ne pas renommer `kind` en `document_type` maintenant.

Garder :

```txt
kind = receipt | quittance
```

Puis clarifier l'UI :

- `receipt` = reçu de paiement, potentiellement partiel ;
- `quittance` = loyer intégralement soldé pour la période couverte.

## Implémentation recommandée Proof Engine

Étape minimale :

1. créer une fonction serveur interne `generateReceiptForConfirmedCollection(receptionId)` ou équivalent ;
2. l'appeler après `confirm_collection` dans `recordCollection` et `confirmCollection` ;
3. conserver `generateReceipt` comme fallback technique ;
4. rediriger après confirmation vers le document généré ou vers collections avec notice explicite si génération échoue ;
5. ajouter tests autour de double confirmation et idempotence.

Point de prudence : l'appel `confirm_collection` + `generate_receipt` côté action n'est pas une transaction unique applicative. La transaction forte est côté RPC individuellement. Une future consolidation DB pourrait exposer une RPC unique `confirm_collection_and_generate_receipt`.

---

# 2. Reminder Engine

## État actuel

DB live : table `reminders` existe, mais schéma ancien/simple.

Code applicatif audité :

- aucun module `apps/web/src/lib/reminders` trouvé ;
- aucun usage applicatif clair de `reminders` trouvé ;
- dashboard ne lit pas `reminders` ;
- pas de `lease_reminder_rules` en DB live ;
- `rent_dues` possède déjà `last_reminder_at`, `next_reminder_at`, `reminder_count` côté DB live, mais ces champs ne sont pas consommés dans les fichiers audités.

## Écart avec la cible

| Sujet | État actuel | Cible | Écart |
|---|---|---|---|
| `lease_reminder_rules` | absent | règles de rappel/relance par bail | majeur |
| génération depuis bail | absente | relances générées depuis règles + échéances | majeur |
| UI relances | absente | relances prévues/envoyées visibles | majeur |
| dashboard | mentionne “relancer ou encaisser” mais sans moteur | afficher relances réelles | moyen/majeur |
| historique relances | absent côté UI | historique visible | majeur |

## Décision recommandée

Ne pas supprimer les champs existants sur `rent_dues` immédiatement.

Ajouter le modèle cible de manière additive :

1. créer `lease_reminder_rules` ;
2. enrichir `reminders` avec `lease_id`, `lease_reminder_rule_id`, `scheduled_for`, `queued_at`, `failed_at` ;
3. élargir les statuts sans casser l'existant ;
4. ajouter un module applicatif `apps/web/src/lib/reminders` ;
5. connecter le dashboard seulement après génération fiable.

---

# 3. Dashboard

## État actuel

`apps/web/src/app/(app)/dashboard/page.tsx` lit :

- propriétés ;
- logements ;
- locataires ;
- baux ;
- soldes d'échéances via `rent_due_balances`.

Le dashboard calcule :

- retards ;
- attendu ;
- déjà encaissé ;
- priorité à encaisser ;
- prochaine action.

Il ne lit pas :

- `reminders` ;
- reçus/quittances récents ;
- documents à générer ;
- relances prévues/envoyées.

## Écart avec cible

Le dashboard est cohérent avec Sprint 6, mais pas encore avec Sprint 7/8.

Il doit rester stable tant que Reminder Engine et Proof Engine ne sont pas implémentés.

---

# 4. Risques principaux

## Risque 1 — Génération document non atomique avec confirmation

Si on ajoute simplement un appel à `generate_receipt` après `confirm_collection`, on obtient une orchestration en deux RPC.

Risque : confirmation réussie, génération échoue.

Mitigation MVP : afficher notice claire, fallback `documents/generate`, idempotence déjà côté `generate_receipt`.

Mitigation robuste : RPC unique transactionnelle `confirm_collection_and_generate_receipt`.

## Risque 2 — Confusion UI reçu/quittance

Le code utilise `kind = receipt | quittance`.

La doc parle parfois de reçu partiel / reçu complet / quittance.

Mitigation : garder le modèle DB actuel et clarifier les labels UI avant d'ajouter une nouvelle colonne.

## Risque 3 — Relances affichées sans moteur fiable

Le dashboard dit déjà “Relancer ou encaisser”, mais il ne s'appuie pas sur de vraies relances.

Mitigation : ne pas ajouter d'UI relance avant `lease_reminder_rules` + génération idempotente.

## Risque 4 — Champs reminder existants dispersés

`rent_dues` possède des champs de rappel live, mais la cible veut une table `reminders` comme historique.

Mitigation : migration additive et dépréciation progressive, pas suppression.

---

# 5. Plan recommandé

## Étape A — Proof Engine minimal

1. Créer une action interne qui confirme puis génère ou génère après confirmation.
2. Appeler `generate_receipt` après `confirm_collection`.
3. Rediriger vers le document généré si succès.
4. Conserver le bouton manuel comme fallback seulement si le document manque.
5. Ajouter tests.

## Étape B — Proof Engine robuste

Créer une RPC transactionnelle unique :

```txt
confirm_collection_and_generate_receipt(p_reception_id uuid)
```

Elle doit :

- verrouiller la réception ;
- confirmer si possible ;
- recalculer les échéances ;
- générer ou retourner le document actif ;
- auditer l'action ;
- retourner `receipt_id`.

## Étape C — Reminder Engine DB

1. Créer `lease_reminder_rules`.
2. Enrichir `reminders`.
3. Ajouter contraintes anti-doublon.
4. Ajouter tests SQL.

## Étape D — Reminder Engine app

1. Ajouter module `apps/web/src/lib/reminders`.
2. Ajouter génération des relances prévues.
3. Ajouter lecture relances dashboard.
4. Ajouter UI fiche bail et dashboard.

---

# 6. Ce qu'il ne faut pas faire maintenant

- Ne pas renommer `receipts.kind` immédiatement.
- Ne pas supprimer `last_reminder_at`, `next_reminder_at`, `reminder_count`.
- Ne pas afficher de relances “automatiques” tant que la génération n'est pas fiable.
- Ne pas transformer `api.md` en pseudo-spec détaillée.
- Ne pas démarrer Reminder Engine avant d'avoir migrations et tests SQL.

## Conclusion

Le prochain changement de code le plus sûr est Proof Engine minimal : automatiser la génération du document après confirmation, en s'appuyant sur la RPC `generate_receipt` déjà idempotente.

Le Reminder Engine demande d'abord une migration DB additive et des tests SQL.
