# Design — Confirmer un paiement reçu

- **Source** : prototype Claude Design « Prototype visuel Ranti » (handoff HTML/CSS/JS, écran `Paiement` / « Confirmer un paiement reçu »), converti en composants React/Tailwind.
- **Date** : 2026-07-02.
- **Statut** : retenu, implémenté (`apps/web/src/app/(app)/collections/new/page.tsx`), à valider terrain.
- **Écran concerné** : Validation de paiement (`/collections/new`).

## Hypothèses UX

- Le propriétaire ne fait *que* confirmer un paiement déjà reçu hors Ranti (espèces ou Mobile Money) — Ranti relance de son côté, le propriétaire ne relance pas et ne saisit pas de paiement à venir.
- La confirmation doit se sentir comme un geste unique et sans ambiguïté : choisir le bail, confirmer le montant, la quittance part automatiquement.

## Décisions prises

- Copie alignée sur le modèle produit corrigé (voir `chats/chat1.md`) : titre et bouton renommés « Confirmer un paiement reçu » (au lieu de « Encaisser un loyer » / « Enregistrer l'encaissement »), avec la phrase d'intention : « Le loyer vous a été payé hors Ranti — espèces ou Mobile Money. Confirmez-le : la quittance est générée automatiquement. »
- Aucun changement de logique métier : `recordCollection` (`src/lib/collections/actions.ts`) enregistre déjà l'encaissement, le confirme et déclenche `generate_receipt` en une seule action serveur — ce comportement correspond exactement au modèle « confirmer = quittance immédiate » du prototype, donc rien à changer côté serveur.
- Restylage complet en système Ranti : cartes blanches à filet chaud (`--border`), champs à coins 12px (`rounded-xl`), bouton de confirmation en pilule orange (`--accent`) avec la lueur chaude du système (`shadow-accent`).
- Le flux réel a deux étapes (choix du bail actif, puis montant/méthode/allocations par échéance) — plus riche que le formulaire à un seul champ du prototype (locataire + mois + montant). On a conservé les deux étapes et les allocations par échéance (nécessaires au modèle de données réel) plutôt que de les simplifier, pour ne pas perdre de fonctionnalité déjà livrée.
- Les avertissements du prototype (montant supérieur au solde → avance ; mois déjà payé → doublon) n'existent pas dans le moteur actuel et n'ont pas été ajoutés : ce sont des règles métier, pas seulement visuelles, hors du périmètre d'une passe de design.

## Points à tester terrain

- Vérifier que « Confirmer le paiement reçu » comme unique libellé de bouton (au lieu de « Valider » / « Enregistrer ») reste clair pour un propriétaire qui n'a pas suivi l'évolution de copie.
- Le message d'erreur serveur (`params.error`) reste un simple texte rouge sans les avertissements « doublon » / « avance » illustrés dans le prototype — à revisiter si ces règles métier sont un jour implémentées.
