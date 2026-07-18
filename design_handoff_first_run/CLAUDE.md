# CLAUDE.md — Règles impératives pour Ranti

> **À lire avant toute tâche.** Ce fichier fait autorité. Il encode des décisions prises sur plusieurs jours de design. Tu dois t'y conformer **à la lettre**. En cas de doute, tu **demandes** — tu n'inventes pas, tu ne simplifies pas, tu ne « modernises » pas.

## 0. Directive première (non négociable)

1. **Respecte strictement** le flow, le design, les couleurs, la typo, le copy et les composants décrits ici et dans `design_handoff_first_run/`. Ne t'écarte de RIEN sans accord explicite.
2. **N'invente aucune couleur, police, marge, formulation ou écran.** Tout vient des tokens et des références. Si une valeur manque, demande — ne devine pas.
3. **Ne simplifie pas, ne « refais pas en mieux ».** Le minimalisme ici est voulu et travaillé ; le dépouillement n'est pas une invitation à retirer du sens.
4. **Reproduis fidèlement** les prototypes de référence (`design_handoff_first_run/prototypes/`, `Landing.html`). Ce sont la source de vérité visuelle. Réimplémente-les en composants de notre stack — ne les copie pas tels quels (ce sont des `.dc.html` de maquette).
5. Si tu changes quelque chose de visible, **liste-le explicitement** dans ta réponse pour validation.

## 1. Ce qu'est Ranti (à ne jamais trahir)

- **Un registre de loyer** pour propriétaires africains. Pas une banque, pas un wallet.
- **NON-CUSTODIAL : Ranti ne touche JAMAIS l'argent.** Le loyer va directement du locataire au propriétaire (cash, Mobile Money, virement). Ranti garde la **preuve**, jamais les fonds. Ce point doit rester vrai partout — copy, UX, mentions légales.
- **Le propriétaire valide** chaque paiement. Rien n'est marqué payé automatiquement.
- **Auth = Google uniquement** (ADR-010). Aucun autre mode de connexion.
- **Abonnement** : gratuit pour 1 logement, puis paliers (0 / 4 900 / 14 900 FCFA). Aucune commission sur les loyers.

## 2. Voix & copywriting (strict)

- **Langue : français.** Ton « registre-notaire » : calme, sobre, premium, respectueux. Phrases courtes. Ranti parle pour lui-même.
- **INTERDIT : les tirets cadratins « — » (« tirets IA »).** Utilise un point, une virgule ou « : ». Cette règle est absolue, y compris dans le code, les commentaires produit et les textes générés.
- **INTERDIT : les eyebrows/kickers** (petit label en capitales au-dessus des titres). Retirés à la demande de l'équipe.
- **Pas de fioritures, pas d'emphase marketing agressive, pas d'emoji.**
- Le message doit se **comprendre en 5 secondes**. Un CTA visible **sans scroller**.
- Formulations validées à réutiliser telles quelles :
  - H1 landing : « Le registre de loyer des propriétaires africains. »
  - Sous-titre : « Vous encaissez le loyer, Ranti édite la quittance. Il tient votre registre et relance vos locataires à votre place. Vous validez, c'est tout. »
  - Micro-preuve : « Gratuit pour un logement · Ranti ne touche jamais l'argent ».
  - Relance : neutre, signée « du registre » (ce n'est pas le proprio qui relance).

## 3. Couleurs — tokens EXACTS (ne pas dévier)

N'utilise QUE ces variables (définies dans `styles.css` / `tokens/colors.css`). Aucune couleur hors de cette liste, sauf le bleu/rouge/jaune/vert **officiels Google** (logo) et le jaune étoile **#f5b400**.

| Token | Hex | Usage imposé |
|---|---|---|
| `--paper` | **#f7f7f2** | Fond de page (crème) |
| `--muted-surface` | **#f2f2ec** | Section « Comment ça marche », footer, fonds secondaires |
| `--surface` | **#ffffff** | Cartes |
| `--surface-2` | **#fcfcf8** | Pied de carte / barre CTA |
| `--ink-title` | **#211f1c** | Titres, wordmark, chiffres |
| `--ink` | **#292929** | Texte courant, tuile du logo, fond du mockup |
| `--ink-muted` | **#72726e** | Sous-titres, légendes, liens footer |
| `--line` | **#d5d5d2** | Bordures de cartes, séparateurs |
| `--line-soft` | **#e4e3db** | Séparations de sections, lignes de liste |
| `--olive` | **#5b6f00** | **Accent unique** : CTA, halos, soulignements, barres de progression |
| `--olive-deep` | **#4c5616** | Hover CTA, chiffre « Payé » |
| `--olive-wash` | **#f2f6e1** | Fonds olive doux, halos |
| `--leaf` | **#94f27f** | Ligne « payé » du logo, traits d'accent (étapes) |
| `--warning` | **#bd4a30** | Montant/badge « En retard » |
| `--warning-wash` | **#ffe7e2** | Fond du badge « En retard » |
| `--accent-foreground` | **#fcfcf8** | Texte sur bouton olive |

**Règle d'accent : un seul accent, l'olive**, réservé à l'action principale. Le vert feuille est réservé à l'état « payé/confirmé ». Ne colore pas au hasard. Pas de dégradés criards, pas de halos colorés parasites.

## 4. Typographie

- **Display / titres / wordmark / chiffres : Fraunces** (serif). Poids 700–800, `letter-spacing:-.02em à -.03em`.
- **Corps / labels / boutons : Hanken Grotesk** (sans). Poids 400–600.
- Chargées via `next/font/google` dans l'app. Ne substitue pas d'autres polices (surtout pas Inter/Roboto/Arial).

## 5. Le flow de prise en main (first-run) — respecter les états

Référence : `design_handoff_first_run/prototypes/FirstRun.dc.html` + `dev-notes.md`.

États : `welcome` → (skip) `exploration` **ou** (guidé) `setup` → `lease` → `active`.

- **Jamais bloquant.** L'accueil offre « Commencer » **et** « Passer pour l'instant » (+ croix de fermeture).
- **`exploration` = état vide honnête** : tableau de bord calme, **une seule** action (« Créer un bail »), lien « Reprendre la prise en main guidée ». **Pas** de checklist forcée, pas de CTA qui pulse.
- **Reprise** possible à tout moment : « Reprendre la prise en main » dans la sidebar + le menu mobile. Pas de cul-de-sac si le proprio quitte en cours.
- **Créer un bail depuis `exploration`** réengage le parcours guidé.
- **Déconnexion** : bouton dans la sidebar (icône, à côté du profil) + entrée « Se déconnecter » dans le menu mobile. Réinitialise la session → à brancher sur le vrai signout Supabase.

## 6. Quittance

Référence : `FirstRun.dc.html` (modale proprio) + `QuittanceLocataire.dc.html` (page publique locataire).

- Badge d'état : **« Confirmée »** (jamais « Certifiée »).
- Afficher l'**empreinte SHA-256** comme preuve d'intégrité (placeholder `c7a19b4e…d80f42e0` en maquette → **hash réel calculé côté serveur** à l'émission).
- **Page locataire** : publique, mobile-first, ouverte via lien/QR, **sans compte**. Le locataire vérifie puis confirme en un geste. Libellé du bouton : **« Confirmer le paiement »** (amendement 2026-07-18 : « la réception » était ambigu, le locataire atteste que le loyer a été réglé).
- **À CÂBLER (placeholders maquette)** : QR réel vers `ranti.app/q/<ref>`, partage WhatsApp (`wa.me` + PDF joint), export PDF, confirmation serveur horodatée + verrouillage. Numérotation de référence séquentielle réelle.

## 7. Support

- **Centre d'aide sur Notion** en attendant WhatsApp. Le bloc support propose des **guides** (Créer un bail / Valider un paiement / Programmer les relances) + « Ouvrir le centre d'aide ».
- Le **support WhatsApp arrive plus tard** — prévoir le point d'entrée mais ne pas le présenter comme actif.
- Ne réintroduis pas de numéro WhatsApp en dur (retiré volontairement).

## 8. Landing page — structure & règles

Référence : `Landing.html`. Structure figée : **header → hero → « Comment ça marche » (avec aperçu produit) → FAQ → footer**.

- **Header** : wordmark animé (voir §9) à gauche ; à droite « Se connecter » (ghost) SEUL (amendement 2026-07-18 : le bouton « Commencer » du header est retiré, deux CTA côte à côte faisaient trop). Le **CTA unique est le grand « Commencer avec Google » du hero**.
- **Hero centré**, épuré, CTA « Commencer avec Google » au-dessus de la ligne de flottaison. Sous le CTA : preuve sociale « 4,5 sur **Google** · 214 avis » (le mot « Google » souligné en olive).
- **Aperçu produit** : le mockup doit refléter le **vrai dashboard** (« Bonjour Florentine », bandeau Payé/Attendu/Retard, liste « À encaisser », CTA « Confirmer un paiement »). Pas un faux écran générique.
- **Section « Comment ça marche »** sur fond `--muted-surface` (distinct du hero).
- **Footer** : liens **Terms of Service / Privacy Policy / Support** (pages `Terms.html`, `Privacy.html`, `Support.html`). **Pas** de « © 2026 Ranti », **pas** de bloc wordmark/tagline, **pas** de lien FAQ dans le footer. FAQ accessible par scroll.
- Content-width max via `--content-max`. Responsive : grilles qui passent en 1 colonne < 860px.

## 9. Animations (subtiles, reduced-motion obligatoire)

Recrée-les en React/CSS (Web Animations API pour le logo). Ne les copie pas du prototype.

1. **Logo « Ledger Draw »** : au chargement, les 3 filets du registre se tracent gauche→droite (`scaleX` 0→1, origin gauche), le **filet vert en dernier**. Délais 50 / 280 / 500 ms, durée 500 ms, easing `cubic-bezier(0.16,1,0.3,1)`. Rejeu via props `animate` + `playKey` (au survol, ou à la confirmation d'un paiement). Composants : `RantiLogo` / `RantiWordmark`.
2. **Fond fixe** (`position:fixed;inset:0;z-index:-1;pointer-events:none`) :
   - 3 **halos** flous (`blur(70px)`, `opacity≈.5`) en `--olive-wash`, `--olive-chip`, `--leaf` translucide, dérive lente (34 / 42 / 50 s, `ease-in-out infinite`).
   - **Trame de points** : `radial-gradient` 1,1px, `background-size:28px`, `opacity≈.14`, glissement 55 s linéaire.
3. **Apparition hero** : fade + `translateY(14px→0)`, 0,7 s.
4. **`@media (prefers-reduced-motion:reduce)` coupe toutes ces animations.** Non négociable.

Durées/easings depuis `tokens/effects.css` (`--dur-*`, `--ease-enter`, `--ease-standard`).

## 10. Composants du design system (réutiliser, ne pas réinventer)

`Button`, `StatusBadge`, `Card`, `Field`, `Stat`, `Amount`, `RantiLogo`, `RantiWordmark`. Namespace runtime : `window.RantiDesignSystem_ac6719`.

- **Bouton accent** = `--olive` + texte `--accent-foreground`. **Ghost** = texte `--ink-muted`, fond transparent. Pills réservés aux actions ; rayons selon `tokens/spacing.css`.
- **StatusBadge** : vocabulaire réel (payé/confirmé = vert, retard = warning, en attente/relance = neutre). Toujours un label, jamais un badge vide.
- Chiffres en **Fraunces**, `font-variant-numeric: tabular-nums`, format FCFA (« 100 000 FCFA »).

## 11. Ce qui est « maquette » vs « à câbler »

Traite explicitement comme **à implémenter côté dev** (voir `dev-notes.md`) : QR réel, WhatsApp `wa.me` + PDF joint, export PDF, confirmation serveur horodatée, hash SHA-256 serveur, persistance skip/progression (survit à déconnexion / changement d'appareil), signout Supabase, moteur de relances réel, URL publique du centre d'aide Notion. Ne présente jamais un placeholder comme fonctionnel.

## 12. Fichiers de référence (source de vérité)

- `design_handoff_first_run/README.md` — vue d'ensemble du handoff.
- `design_handoff_first_run/dev-notes.md` — tout ce qui reste à câbler + décisions de design.
- `design_handoff_first_run/prototypes/` — prototypes fidèles (first-run, quittance locataire).
- `design_handoff_first_run/styles.css` + `tokens/` — tokens (couleurs, typo, espacements, effets). **Valeurs à reprendre telles quelles.**
- `Landing.html`, `Terms.html`, `Privacy.html`, `Support.html` — landing + pages légales/support.

## 13. Amendements post-handoff (décisions du propriétaire du design)

Décisions prises après la rédaction de ce document ; elles PRIMENT sur le texte
et les prototypes d'origine.

- **2026-07-18 · Header landing** : « Se connecter » seul au header ; le bouton
  « Commencer » est retiré (un seul CTA, celui du hero). Voir §8 amendé.
- **2026-07-18 · Bouton locataire** : « Confirmer le paiement » remplace
  « Confirmer la réception » sur la page publique de quittance. Voir §6 amendé.
- **2026-07-18 · Menu mobile unique** : le hamburger et l'avatar côte à côte
  faisaient doublon ; un seul menu, l'identité (avatar + nom + « Propriétaire »)
  vit en tête du menu déroulant, « Se déconnecter » en fin. Appliqué à l'espace
  connecté ET au parcours de prise en main.
- **2026-07-18 · Clause notariale** : la quittance porte « Je soussigné(e)
  {propriétaire}, propriétaire, reconnais avoir reçu de {locataire} la somme de
  {montant en chiffres} ({montant en toutes lettres}), au titre du loyer de
  {période}, dont quittance pour solde de ladite période. » (reçu partiel :
  « à titre de paiement partiel »). Identique sur les 4 surfaces (page
  locataire, PDF, page bailleur, modale FirstRun). L'empreinte SHA-256 n'est
  affichée QUE quand le serveur la calcule (jamais de placeholder).
- **2026-07-18 · Pas de mode sombre** : la palette claire de ce handoff est la
  seule ; `color-scheme: light` est figé dans l'app (le dark système
  n'inverse plus rien).
- **2026-07-18 · Éditeur légal** : WI'SOFT SOLUTIONS (RCCM RB/COT/20 A 62590,
  IFU 0202377982188), contact mrkpatinde@gmail.com, sur toutes les surfaces
  publiques (footer, CGU, confidentialité).

---

**Rappel final :** si le résultat s'écarte du design validé, c'est un bug, pas une amélioration. En cas d'ambiguïté : arrête-toi et demande.
