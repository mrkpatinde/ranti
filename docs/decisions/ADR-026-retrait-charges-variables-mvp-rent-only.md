# ADR-026 — Retrait des charges variables : Ranti MVP rent-only

## Statut

Accepté (2026-07-22, décision CEO). Supersède la **phase « différenciant »**
d'ADR-023 (charges variables affirmées par le bailleur, validées ou contestées
par le locataire via lien signé). Ne touche pas le grand livre côté loyer, ni
les crédits / déclarations locataire, ni les frais PSP.

## Contexte

Les charges variables (réparations, frais partagés facturés au locataire, avec
matrice de validation et cycle de vie du litige) sont, en pratique, impossibles
à faire passer sur le terrain aujourd'hui : le flux locataire est trop lourd
pour le pilote, et il détourne le produit de sa valeur nette, la quittance
vérifiable. La question « faut-il les rattacher au loyer ou éditer des reçus à
part » a été tranchée : on les retire.

Cap produit : l'app doit être la plus simple possible et **montrer la preuve dès
le début**. Un propriétaire doit pouvoir, en un geste, générer une quittance
pour un loyer déjà payé, en guise de test, et ressentir la valeur immédiatement.

## Décision

1. **Rent-only.** Ranti ne gère plus que le loyer : échéances, encaissements
   confirmés, quittances vérifiables, relances. Un bailleur qui veut facturer
   davantage ajuste le loyer du bail ; Ranti ne modélise plus de charge à part.

2. **Retrait des surfaces charges.** Suppression des points d'entrée et des
   écrans : création / correction de charge (`/leases/[id]/charges/**`), page
   publique de validation locataire (`/transaction/[token]`), branche charge des
   relances programmées, section « Charges & frais » de la fiche bail, agrégat
   « en litige » du tableau de bord. Le code mort correspondant est supprimé
   (`lib/ledger/{actions,contest,whatsapp}.ts`, types et requêtes charge-only).

3. **Base dormante d'abord.** Aucune migration destructive dans ce lot. Les
   objets DB des charges (tables, fonctions RPC, colonnes `pending_debits` /
   `disputed_debits` de `lease_balances`, `tenant_token`, `charge_id` de
   `scheduled_reminders`, vues ops) restent en place mais ne sont plus
   référencés par le code : sans création de charge, ces colonnes valent 0
   partout. Le **drop** (migrations forward-only) est un lot de suivi, une fois
   vérifié contre la production (voir la note de drift migrations prod↔repo).

4. **La preuve d'abord.** La prise en main pousse, dès le bail créé, la
   génération d'une quittance pour un loyer déjà payé. On réutilise le flux
   existant `/collections/new` (« Le loyer vous a été payé hors Ranti, la
   quittance est générée automatiquement », `recordCollection` →
   `generate_receipt`). Aucun nouveau mécanisme.

## Conséquences

- Le grand livre de loyer (ADR-023 §1, §2, §5, §6, §8, §9) reste la vérité des
  impayés et soldes : `certain_balance`, `overdue_amount`, `pending_credits`.
  Seule la couche débits affirmés par le bailleur (charges) sort.
- La matrice de validation (ADR-023 §3), le cycle de vie du litige (§4) et la
  surface locataire à liens signés (§7) ne s'appliquent plus qu'au flux crédits
  (déclaration locataire), hors périmètre de ce retrait.
- Les colonnes dormantes gardent la parité de lecture (`LEASE_BALANCES_SELECT`
  inchangé) ; elles disparaîtront au lot de drop.
- Docs mises à jour : ADR-023 (note de supersession), `domain-model.md`,
  `database.md` (objets marqués dormants), `architecture.md`, `vision.md`,
  `BUILD_STATUS.md`.

## Suivi

- Lot de drop DB : down-migrations forward-only supprimant tables, fonctions,
  policies et colonnes charge, puis nettoyage de la vue `lease_balances` et du
  type `LeaseDebtRow`.
- Décision à réévaluer si le terrain demande une facturation de charges : elle
  reviendrait alors avec un flux locataire beaucoup plus léger que la matrice
  d'origine.
