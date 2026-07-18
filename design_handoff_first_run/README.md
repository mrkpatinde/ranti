# Ranti — Handoff : prise en main propriétaire + quittance locataire

Package de handoff pour implémentation en codebase réelle (React/Next côté Ranti). Les prototypes ici sont des **Design Components** (`.dc.html`) : maquettes fidèles et interactives, à traduire en composants applicatifs — ce ne sont pas des fichiers à copier tels quels en prod.

## Contenu

- `prototypes/FirstRun.dc.html` — espace propriétaire : accueil, prise en main guidée, état vide « exploration », modale quittance, relances, déconnexion, modale « Centre d'aide ». Corps du tableau de bord dans `FirstRunMain.dc.html`.
- `prototypes/QuittanceLocataire.dc.html` — page publique mobile-first (lien WhatsApp / QR) : le locataire vérifie et confirme la réception, sans compte.
- `prototypes/support.js`, `ds-base.js` (+ variantes `qlocataire-*`) — runtime des prototypes et chargeur du design system. Ne sert qu'à faire tourner les maquettes, pas à porter en prod.
- `dev-notes.md` — liste exhaustive de ce qui reste à câbler et des décisions de design à préserver.
- `styles.css` — tokens du design system Ranti (couleurs, typo, rayons, ombres, durées). Source de vérité pour les valeurs à reprendre.

## Comment ouvrir les prototypes

Les `.dc.html` s'ouvrent dans un navigateur mais dépendent du design system Ranti (chargé via `ds-base.js`, qui pointe vers `_ds_bundle.js` du projet design system). Le plus simple pour explorer le comportement : les consulter dans le projet de design d'origine. Pour comprendre la structure/les valeurs : lire le markup inline (styles inline = valeurs directement lisibles) et `styles.css`.

## Parcours propriétaire (états)

`welcome` → (skip) `exploration` **ou** (guidé) `setup` → `lease` → `active`.

- **Accueil** : deux voies — commencer la configuration, ou « Passer pour l'instant » (croix + bouton). Jamais bloquant.
- **exploration** : tableau de bord vide honnête, une seule action (« Créer un bail »), lien « Reprendre la prise en main guidée ». Pas de checklist forcée.
- **Reprise** : « Reprendre la prise en main » (sidebar + menu mobile) relance le guidage à tout moment.
- **Déconnexion** : réinitialise la session (retour accueil) — à remplacer par un vrai signout Supabase.

## À câbler (résumé — détail dans `dev-notes.md`)

- QR code réel → `https://ranti.app/q/<ref>` ; référence séquentielle réelle.
- Partage WhatsApp (deep link `wa.me` + PDF joint) et export PDF de la quittance.
- Confirmation locataire → POST au registre avec horodatage serveur + verrouillage.
- Empreinte SHA-256 réelle calculée côté serveur (placeholder `c7a19b4e…d80f42e0` dans la maquette).
- Persistance skip/progression de la prise en main (survit à déconnexion / changement d'appareil).
- Support : centre d'aide **Notion** (câbler l'URL publique) en attendant de rebrancher WhatsApp.
- Moteur de relances réel (WhatsApp / SMS) à la place de la simulation.

## Design system

Tokens dans `styles.css`. Composants réutilisés dans les prototypes : `RantiWordmark`, `StatusBadge`, `Button`, `Card`, `Field`, `Stat`, `Amount`, `RantiLogo`. Reprendre les valeurs (hex, espacements, rayons, ombres) depuis `styles.css` plutôt que de les redéfinir.

## Prompt suggéré pour Claude Code

> Implémente l'espace de prise en main propriétaire et la page de quittance locataire de Ranti à partir de ce package de handoff. Lis `README.md` puis `dev-notes.md`. Reproduis fidèlement les états et parcours décrits (accueil non bloquant, skip → exploration, reprise, quittance, déconnexion, centre d'aide Notion). Utilise les tokens de `styles.css`. Traite comme à câbler : QR réel, partage WhatsApp + PDF, confirmation serveur avec horodatage, hash SHA-256 serveur, persistance de la progression, signout Supabase. Ne copie pas les `.dc.html` : ré-implémente en composants applicatifs de notre stack.
