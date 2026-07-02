# Ranti — Implementation Plan Reminder Engine et Proof Engine

## Statut

Version 0.1 — plan d'audit et d'implémentation.

Ce document ne demande pas de coder immédiatement. Il sert à comparer la cible documentaire avec l'état réel du repo, puis à exécuter les changements dans un ordre sûr.

## Objectif

Mettre en œuvre deux moteurs produit dans Ranti :

1. Reminder Engine : à partir du bail et des échéances, Ranti prépare ou automatise les rappels et relances.
2. Proof Engine : après validation du paiement par le propriétaire, Ranti génère automatiquement le document adapté.

## Règle de travail

Ne pas implémenter avant d'avoir produit une gap analysis claire.

Tout changement doit respecter :

- ADR-001 : scope MVP limité au suivi des loyers ;
- ADR-006 : rappels et relances à partir du bail ;
- ADR-007 : reçus et quittances automatiques après validation ;
- `docs/database.md` ;
- `docs/api.md` ;
- les migrations existantes ;
- les invariants financiers déjà stabilisés.

---

# 1. Audit d'écart obligatoire

## Objectif

Comparer l'état réel du code et des migrations avec la cible documentaire.

## Livrable attendu

Créer une section ou un rapport temporaire avec ce tableau :

| Sujet | Cible docs | État actuel | Écart | Action recommandée | Risque |
|---|---|---|---|---|---|
| `lease_reminder_rules` | règles liées au bail | à vérifier | à compléter | migration | moyen |
| `reminders` | générées depuis règles/échéances | à vérifier | à compléter | migration + actions | moyen |
| `receipts.document_type` | reçu partiel / reçu complet / quittance | à vérifier | à compléter | migration | élevé |
| confirmation paiement | génère documents automatiquement | à vérifier | à compléter | actions + tests | élevé |
| dashboard | relances + documents générés | à vérifier | à compléter | UI | moyen |
| API | endpoints documentés | à vérifier | à compléter | routes/actions | moyen |

## Prompt Claude — audit seulement

```txt
Tu es Staff Engineer et Product Engineer senior.

Contexte : Ranti est un registre de loyer actif. Les docs ont introduit Reminder Engine et Proof Engine.

Mission : fais uniquement une gap analysis entre les docs et le code existant. Ne modifie aucun fichier.

Docs à lire :
- README.md
- docs/vision.md
- docs/principes.md
- docs/domain-model.md
- docs/database.md
- docs/api.md
- docs/decisions/ADR-006-automated-reminders-from-lease.md
- docs/decisions/ADR-007-automatic-receipts-after-payment-validation.md

Code/migrations à inspecter :
- supabase/migrations
- apps/web/src/lib
- apps/web/src/app
- tests SQL et Vitest existants

Livrable :
1. état actuel exact
2. écarts avec la cible
3. fichiers concernés
4. migrations nécessaires
5. fonctions/actions à modifier
6. UI à modifier
7. tests manquants
8. risques de régression
9. plan d'implémentation ordonné

Interdiction : ne code rien, ne crée aucune migration, ne modifie aucun fichier.
```

---

# 2. Reminder Engine — cible métier

## Définition

Le Reminder Engine permet à Ranti de préparer ou automatiser les rappels et relances à partir du bail et des échéances.

## Règles métier

1. Une règle de rappel/relance appartient à un bail.
2. Une règle inactive ne génère plus de nouvelles relances.
3. Une relance vise toujours une échéance.
4. Une relance ne confirme jamais un paiement.
5. Une relance ne modifie jamais un reçu ou une quittance.
6. Une échéance soldée ne doit pas recevoir de relance de retard.
7. Une échéance partiellement payée peut recevoir une relance sur le solde restant.
8. Une génération répétée ne doit pas créer de doublon.
9. Une relance envoyée ou mise en file doit rester historisée.
10. Un bail terminé ou suspendu ne doit pas générer de nouvelles relances.

## Règles candidates par défaut MVP

Ces valeurs doivent être validées produit avant implémentation :

- rappel avant échéance : 2 jours avant ;
- rappel jour J : le jour de l'échéance ;
- relance après retard : 1 jour après échéance ;
- canal MVP prudent : `manual` ou WhatsApp préparé ;
- envoi externe automatique : post-MVP ou MVP contrôlé.

## Cas limites à trancher

- Date d'échéance le 31 dans un mois de 30 jours.
- Bail qui commence au milieu du mois.
- Bail suspendu.
- Locataire sans numéro de téléphone.
- Paiement partiel avant échéance.
- Paiement enregistré après relance envoyée.
- Changement de montant de loyer.
- Modification d'une règle après génération de relances.

---

# 3. Proof Engine — cible métier

## Définition

Le Proof Engine transforme un paiement validé par le propriétaire en preuve propre, historisée et non modifiable silencieusement.

## Règles métier

1. Le propriétaire valide la réception réelle du paiement.
2. Ranti ne confirme pas un paiement sur simple déclaration locataire.
3. Après validation, Ranti met à jour l'échéance.
4. Après validation, Ranti calcule le solde restant.
5. Paiement partiel validé : générer un reçu de paiement partiel.
6. Échéance soldée : générer une quittance ou un reçu complet.
7. Un document généré conserve un snapshot.
8. Un document généré ne se modifie jamais silencieusement.
9. Toute correction passe par annulation ou remplacement tracé.
10. Le numéro de document est unique par propriétaire.
11. Une génération répétée ne doit pas créer de doublon.

## Cas limites à trancher

- Plusieurs paiements partiels pour une même échéance.
- Paiement qui couvre plusieurs mois.
- Paiement supérieur au solde attendu.
- Annulation d'une réception après génération de document.
- Remplacement de document.
- Document PDF généré mais stockage échoué.
- Confirmation répétée par double clic.
- Reçu partiel puis quittance finale.

---

# 4. Migrations probables

## À vérifier avant création

Ne pas créer ces migrations sans audit préalable.

## Candidats

1. Ajouter `lease_reminder_rules`.
2. Enrichir `reminders` avec `lease_id`, `lease_reminder_rule_id`, `scheduled_for`, `queued_at`, `failed_at`.
3. Ajouter `document_type` à `receipts` si absent.
4. Ajouter ou vérifier les contraintes d'unicité des documents.
5. Ajouter ou vérifier les index liés aux relances.
6. Ajouter les audit actions nécessaires.
7. Ajouter les fonctions de génération idempotente si le pattern existe déjà.

## Contraintes SQL à prévoir

- `lease_reminder_rules.landlord_id = leases.landlord_id`.
- `reminders.landlord_id = rent_dues.landlord_id`.
- Une relance générée depuis règle doit être unique par règle, échéance et canal.
- `receipt_number` unique par propriétaire.
- Document généré lié à réception confirmée.
- Pas de document actif dupliqué pour le même contexte métier.

---

# 5. Server actions / API à vérifier

## Reminder Engine

À chercher dans le repo :

- actions liées aux baux ;
- actions liées aux échéances ;
- actions liées aux relances ;
- jobs éventuels ;
- dashboard summary.

Actions probables à créer ou modifier :

- créer règle de rappel ;
- activer/désactiver règle ;
- générer relances dues ;
- mettre en file une relance ;
- annuler relance ;
- lire relances dashboard.

## Proof Engine

À chercher dans le repo :

- `confirm` réception ;
- `generate_receipt` ;
- annulation/remplacement de reçu ;
- PDF generator ;
- tests ADR-005.

Actions probables à modifier :

- confirmer réception doit déclencher génération automatique ;
- génération manuelle devient fallback technique ;
- annulation doit respecter les documents actifs ;
- remplacement doit conserver l'historique.

---

# 6. UI à modifier

## Dashboard mensuel

Doit afficher :

- loyers attendus ;
- encaissé ;
- reste à encaisser ;
- retards ;
- relances prévues ;
- relances envoyées ;
- paiements à confirmer ;
- documents générés récemment ;
- action principale du moment.

## Fiche bail

Doit afficher :

- règles de rappel/relance ;
- automatisation active ou suspendue ;
- prochaine relance prévue ;
- historique de relances ;
- bouton modifier règles.

## Validation paiement

Doit afficher avant confirmation :

- montant reçu ;
- échéance concernée ;
- solde avant/après ;
- document qui sera généré ;
- avertissement si paiement partiel ;
- confirmation claire.

## Reçu / quittance

Doit distinguer :

- reçu partiel ;
- reçu complet ;
- quittance ;
- document annulé ;
- document remplacé.

---

# 7. Tests d'acceptation

## Reminder Engine

- Bail actif avec échéance le 5 : rappel généré avant le 5.
- Échéance payée : aucune relance après échéance.
- Échéance partiellement payée : relance sur solde restant.
- Règle désactivée : aucune nouvelle relance.
- Génération répétée : pas de doublon.
- Bail terminé : pas de nouvelles relances.
- Relance annulée : reste historisée.
- Relance échouée : statut `failed`, pas de suppression.

## Proof Engine

- Paiement partiel confirmé : reçu partiel généré.
- Paiement complet confirmé : quittance ou reçu complet généré.
- Paiement en plusieurs fois : reçu partiel puis quittance finale.
- Confirmation répétée : pas de doublon documentaire.
- Annulation réception avec document actif : bloquée ou flux correction obligatoire.
- Remplacement document : ancien document conservé.
- Numéro document unique par propriétaire.
- Snapshot conservé malgré modification future du locataire ou bail.

## Sécurité

- Un propriétaire ne voit pas les règles, relances, paiements ou documents d'un autre propriétaire.
- Les endpoints retournent `404` hors périmètre.
- Les mutations sensibles sont auditées.
- Les fichiers sensibles ne sont pas publics sans lien contrôlé.

---

# 8. Ordre d'implémentation recommandé

## Étape 1 — Audit d'écart

Aucune modification.

## Étape 2 — Migrations Reminder Engine

Créer ou ajuster `lease_reminder_rules`, enrichir `reminders`, ajouter contraintes et index.

## Étape 3 — Tests SQL Reminder Engine

Valider génération, idempotence, isolation et absence de doublons.

## Étape 4 — Actions Reminder Engine

Créer les actions serveur minimales : règles, génération, annulation, lecture dashboard.

## Étape 5 — Proof Engine technique

Modifier confirmation de réception pour générer automatiquement le document adapté.

## Étape 6 — Tests Proof Engine

Couvrir partiel, complet, multi-paiement, correction, idempotence.

## Étape 7 — UI minimale

Fiche bail, validation paiement, dashboard, documents générés.

## Étape 8 — E2E

Tester le cycle : bail -> échéance -> relance prévue -> paiement validé -> document généré -> historique.

---

# 9. Critères d'acceptation avant merge

Un changement est acceptable seulement si :

- les migrations fresh-apply passent ;
- les tests SQL critiques passent ;
- les tests existants ne régressent pas hors échec déjà documenté ;
- l'isolation propriétaire est respectée ;
- les documents ne sont pas dupliqués ;
- les relances ne sont pas dupliquées ;
- les actions sensibles sont auditées ;
- le scope MVP reste respecté.

---

# 10. Prompt Claude — implémentation après audit validé

```txt
Tu es Senior Fullstack Engineer sur Ranti.

Contexte : la gap analysis Reminder Engine + Proof Engine a été validée. Implémente uniquement l'étape demandée.

Règles :
- ne pas ajouter de fonctionnalité hors scope ;
- respecter ADR-006 et ADR-007 ;
- respecter RLS et isolation landlord ;
- toute mutation sensible doit être transactionnelle et auditée ;
- ajouter tests SQL ou Vitest selon le cas ;
- ne pas casser les flux ADR-004/ADR-005 sur reçus ;
- expliquer les fichiers modifiés, tests lancés et risques restants.

Livrable :
- fichiers modifiés ;
- résumé ;
- tests ;
- risques ;
- verdict prêt pour review.
```
