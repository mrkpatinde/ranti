# Design — Dashboard propriétaire

- **Source** : prototype Claude Design « Prototype visuel Ranti » (handoff HTML/CSS/JS, écran `Dashboard`, variante A), converti en composants React/Tailwind.
- **Date** : 2026-07-02.
- **Statut** : retenu, implémenté (`apps/web/src/app/(app)/dashboard/page.tsx`), à valider terrain.
- **Écran concerné** : Dashboard propriétaire (`/dashboard`).

## Révision v2 — 2026-07-15 (ADR-020, lecture seule)

Le modèle produit a changé : l'encaissement passe par le rail FeexPay (ADR-019),
le propriétaire ne saisit plus rien. Le dashboard devient **lecture seule** —
« qui a payé / qui doit », rien de plus.

- **Contenu** : résumé du mois (Payé / Attendu / Retard), liste « À encaisser »
  (qui doit, retard d'abord ; les payés résumés en « N à jour » pour tenir sans
  scroll), une action unique.
- **CTA** : « Créer un bail » (`/leases/new`) — remplace « Confirmer un paiement »
  (collage SMS / saisie vocale / manuelle retirés).
- **Actions** : menu compte (avatar) = Mon compte · Gérer les baux · Se déconnecter.
  Archiver un bail = bouton **visible** sur le détail (`/leases/[id]`), jamais un
  reveal caché.
- **Données** : `rent_due_balances` agrégé par `lib/dashboard/summary.ts` (pur) ;
  aucune requête nouvelle.
- **Style** : tokens DESIGN.md (Fraunces, olive = seul CTA, retard = destructive),
  esprit iOS natif (aéré), zéro eyebrow.

Supersède les décisions v1 ci-dessous sur le CTA « Confirmer un paiement » et les
StatCard.

## Hypothèses UX

- En moins de 5 secondes, le propriétaire doit voir : combien est encaissé ce mois, combien est en retard (et pour combien de locataires), combien reste à venir.
- L'action prioritaire (« Confirmer un paiement reçu ») doit être atteignable en un clic depuis l'en-tête et depuis chaque ligne d'échéance.

## Décisions prises

- Application du système visuel Ranti : canevas crème (`--background`), encre vert forêt (`--primary`/`--foreground`), accent orange chaud réservé aux appels à l'action (`--accent`), titres en Fraunces (`font-display`), corps en Hanken Grotesk (`font-sans`). Tokens portés dans `apps/web/src/app/globals.css`.
- Les trois `StatCard` reprennent les tons du prototype : `brand` (encaissé), `red` (en retard), `stone` (à venir), plutôt que les tons `danger/warning/success/neutral` génériques précédents.
- Le CTA principal du tableau de bord est renommé « Confirmer un paiement » (au lieu de « Encaisser un loyer ») pour refléter le modèle produit corrigé : Ranti relance, le propriétaire ne fait que confirmer un paiement déjà reçu hors Ranti.
- La chrome (barre latérale / en-tête mobile, `app-shell.tsx`) est restylée avec le même système ; les autres écrans de l'app (locataires, baux, propriétés, logements, quittances, réglages) n'ont pas encore été migrés visuellement — prochaine étape logique.
- Aucune logique de données n'a été modifiée : la même requête (`getLandlordDueBalances`, etc.) alimente l'écran, seul le rendu change.

## Points à tester terrain

- Le CTA « Confirmer un paiement » en en-tête n'est pas contextualisé à un locataire précis (il ouvre `/collections/new` en mode « choisir un bail ») — à valider que ce n'est pas source de confusion face aux CTA contextualisés de la liste « À encaisser maintenant ».
- Pas de variante sombre définie dans le nouveau système ; le thème sombre CSS conservé dans `globals.css` est une extrapolation de la marque (fond vert forêt, texte crème), non testée visuellement faute d'environnement Supabase local dans ce sandbox.
