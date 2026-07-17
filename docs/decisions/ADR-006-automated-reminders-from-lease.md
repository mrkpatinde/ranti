# ADR-006 — Rappels et relances automatiques à partir du bail

> ⚠️ **Collision de numéro.** Deux ADR portent le numéro 006 :
> celui-ci (relances) et
> [ADR-006 — Audit des mutations sensibles](ADR-006-sensitive-mutation-audit.md).
> Une référence nue à « ADR-006 » est ambiguë — vérifier le contexte.
> Répartition observée au 2026-07-17 : `roadmap.md`, `database.md`,
> `implementation-plan-*` et ADR-019 § 6 visent **les relances (ce document)** ;
> ADR-002, ADR-005 et les migrations SQL (`sensitive_mutation_audit`,
> `landlord_identity_lock`) visent **l'audit**.
> Renumérotation non faite : elle exigerait de modifier des commentaires `.sql`.

## Statut

Accepté. Partie « envoi » supersédée par ADR-022 (2026-07-16) : l'envoi est
opéré par ranti-ops (WhatsApp, tracé dans `reminder_events`) ; la cadence née
du bail et des échéances reste la référence, portée par ce dépôt.

## Contexte

Ranti ne doit pas être seulement un registre passif. Si le propriétaire doit ouvrir l'application et se souvenir lui-même de relancer, Ranti reproduit une partie du problème actuel.

Le bail ou accord locatif contient les informations qui permettent à Ranti de connaître les obligations de paiement : montant, période, date d'échéance, locataire, logement et canal de contact.

## Décision

Ranti automatise les rappels et relances à partir du bail renseigné par le propriétaire.

Le propriétaire configure les règles. Ranti suit les échéances, prépare ou déclenche les rappels, détecte les retards et conserve l'historique des relances.

## Nuance MVP

Au MVP prudent, Ranti peut commencer par préparer automatiquement les rappels et relances, puis laisser le propriétaire valider l'envoi selon les contraintes WhatsApp/SMS.

L'envoi automatique complet devient possible quand les contraintes techniques, coûts, opt-in et prestataires sont maîtrisés.

## Conséquences produit

- Le bail devient source de génération des échéances et des relances.
- Le dashboard doit afficher les relances prévues et envoyées.
- La fiche bail doit afficher les règles de rappel et relance.
- Une relance doit toujours viser une échéance.
- Une relance ne modifie jamais le statut de paiement.
- L'historique des relances doit être conservé.

## Conséquences techniques

- Ajouter ou expliciter des règles de rappel liées au bail.
- Distinguer rappel préparé, mis en file, envoyé, échoué, annulé.
- Tracer les tentatives d'envoi quand un prestataire externe est utilisé.
- Auditer la création, l'envoi et l'annulation d'une relance.

## Non-objectifs

- Pas d'agence de recouvrement.
- Pas de message agressif.
- Pas de spam locataire.
- Pas d'envoi automatique non contrôlé sans opt-in ou canal maîtrisé.
