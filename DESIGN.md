# Design System — Ranti

> Source de vérité visuelle. Lire avant toute décision UI. Ne pas dévier sans validation explicite.
> Créé par /design-consultation le 2026-07-15. Boussole : **« Ça, c'est fiable / sérieux »** — sérieux tranquille, la quittance fait foi, rien ne clignote.
> **Référence visuelle vivante : [`direction-artistique.html`](direction-artistique.html)** (racine du repo) — style-guide rendu (cachet certifié, spécimens typo, palette clair/sombre, composants, interdits). En cas d'écart entre ce fichier et la DA, **la DA fait foi** (décision CEO 2026-07-17).

## Product Context
- **Ce que c'est :** registre de loyer pour propriétaires ouest-africains (Bénin d'abord) — suivi des baux, relances WhatsApp depuis le bail, quittances certifiées vérifiables.
- **Pour qui :** propriétaire-bailleur béninois multi-logements, sur Android bas de gamme, terrain.
- **Espace :** proptech / fintech loyers Afrique de l'Ouest. Repère de niveau : obligo.com (craft, PAS l'échelle — preuve Ranti reste honnête).
- **Type :** app produit (dashboard/ledger mobile-first) + site marketing. Une seule source de vérité pour les deux surfaces.

## Aesthetic Direction
- **Direction :** Éditorial / raffiné sobre. Un registre qu'on croit sur parole, pas une énième app tech. Chaud, sérieux, pas froid.
- **Niveau de décoration :** intentionnel. La couche expressive = illustration monoline Bénin (maisons Cotonou/Calavi, MoMo, cachet certifié), **gatée en étape 2** (brief seulement, pas de commande avant observation terrain + signal de demande). Le système réserve son emplacement.
- **Mood :** calme, grave, digne. Le contraire de « startup qui clignote ».
- **Motif signature :** le **cachet certifié** — sceau monoline (cercle + pointillé + coche) qui apparaît sur la quittance, la page `/verifier`, le logo et comme marqueur de section. Équivalent Ranti de la mascotte, mais natif à la vraie valeur : le reçu qui fait foi. Seed du brief illustration.
- **Référence :** obligo.com (éditorial + retenue + illustration monoline).

## Typography
> Réalité prod (source de vérité = `apps/web/src/app/layout.tsx` + `globals.css` `@theme`). Le système est déjà câblé : `--font-display: var(--font-fraunces)`, `--font-sans: var(--font-hanken)`.
- **Display/Hero :** Fraunces — serif old-style variable, chaleur + gravitas. `font-display` = Fraunces. Poids 500 (sous-titres) à 800 (héro).
- **Body / UI :** **Hanken Grotesk** — humaniste chaud, excellente lisibilité (y compris Android bas de gamme). C'est la police de marque en prod ; ne pas la remplacer sans raison forte (mon ancienne proposition Instrument Sans est supersédée par la réalité shippée).
- **Data / Tables (ledger) :** Hanken Grotesk avec **tabular-nums appliqué au niveau du shell app** (`[font-variant-numeric:tabular-nums]` sur le wrapper `AppShell`) — tous les chiffres de l'UI produit sont alignés (choix ledger). Sur la landing marketing, tabular reste au cas par cas sur les montants.
- **Mono / références :** mono système (`ui-monospace, "SF Mono", Menlo`) — références PSP, SMS Mobile Money collé, numéros de transaction. (JetBrains Mono possible plus tard, non câblé aujourd'hui.)
- **Loading :** `next/font/google` (Fraunces, Hanken Grotesk) via `layout.tsx`, variables CSS `--font-fraunces` / `--font-hanken`.
- **Scale (rem, base 16px) :** hero clamp(2.5,7vw,4.75) · h2 2.25–3 · h3 1.375 · lede 1.1875 · body 1 · small 0.875 · micro 0.75. Line-height : titres 1.05, corps 1.55.

## Color
> Palette de référence = **direction-artistique.html**, strictement (décision CEO 2026-07-17 : seules les couleurs de la DA existent dans le projet). L'app utilise des **tokens sémantiques HSL** (`globals.css` `@theme`, style shadcn) qui portent cette palette. Mapping : `--background` = papier crème **#f7f7f2**, `--foreground`/`--primary` = encre #292929, `--accent` = olive #5b6f00 (CTA), `--secondary` = teinte verte #f2f6e1, `--destructive` = #e95d3d, `--warning` = #bd4a30 (retard/attention). Dark mode = palette sombre DA (papier #17171a, surface #1f1f22, encre #eceae3, olive #aebd4a, ring #788c15). **Utiliser les classes tokens** (`bg-accent`, `text-foreground`, `bg-warning/10`…) dans l'app, PAS des hex en dur ni la palette Tailwind générique (`red-*`, `amber-*` interdites — elles cassent le dark mode). Le PDF quittance et le manifest PWA portent les hex DA en dur (pas de CSS là-bas) ; seule exception tolérée : les couleurs officielles du logo Google (bouton OAuth — marque tierce).
- **Approche :** restreinte. L'olive est l'equity de marque — chaud, terre/CFA, africain, démarque du bleu fintech générique.
- **Primary :** `#5b6f00` (olive) — CTA, liens, marque. Accent vif : `#788c15`.
- **Secondary / signaux :** `#94f27f` (feuille) = authentifié/confirmé (quittance, badge « ne détient jamais vos fonds »).
- **Neutrals :** papier `#f7f7f2` (crème DA) · surface `#ffffff` / `#fcfcf8` · encre titres `#211f1c` · corps `#292929` · muted `#72726e` · filets `#e4e3db` / `#d5d5d2`.
- **Tints olive :** chip `#e5eacd` · wash `#f2f6e1`.
- **Sémantique :** succès = olive/feuille · retard/warning = `#bd4a30` sur `#ffe7e2` · erreur = rouge plus profond · info = muted.
- **Dark mode :** redessiner les surfaces (papier `#17171a`, surface `#1f1f22`, encre `#f4f3ee`) ; **éclaircir l'olive** vers `#aebd4a` / accent `#c3d46a` pour le contraste (l'olive foncé disparaît sur fond sombre). Feuille inchangée.

## Spacing
- **Base :** 8px.
- **Densité :** confortable (lisibilité mobile > densité — cible Android terrain).
- **Scale :** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approche :** hybride — grille disciplinée pour l'app/ledger (colonnes d'argent alignées), éditorial pour le marketing.
- **Grille :** 1 col mobile, 12 col desktop ; sections marketing souvent asymétriques.
- **Largeur max contenu :** 1152px (`max-w-6xl`).
- **Border radius :** sm 8px (chips/tags) · md 14–16px (cards) · lg 18–20px (cards preuve) · full 999px (pills CTA + avatars). Ne PAS bubbly-tout — pills réservées aux CTA et badges.

## Motion
- **Approche :** minimal-fonctionnel. Rien qui rebondit (« sérieux »). Micro-moments existants (lp-roll héro, lp-paste dashboard) gardés — figés sur l'état final sous `prefers-reduced-motion`.
- **Easing :** enter ease-out · exit ease-in · move ease-in-out.
- **Durée :** micro 50–100ms · short 150–250ms · medium 250–400ms · long 400–700ms.

## Interdits (anti-slop IA — préférence CEO verrouillée)
- **Pas d'eyebrow / kicker** : jamais de petit label majuscule au-dessus d'un titre (`SIMPLE AU QUOTIDIEN`, `TARIF`, `LE POURQUOI`…). C'est le tell n°1 du slop IA. Le titre porte seul.
- **Rien qui « fait généré »** : pas de témoignages/logos/chiffres fabriqués, pas de métriques inventées (« 2h → 30s », « 1 200 propriétaires »), pas de claims non tenus (encaissement automatique tant que BCEAO gate, apps natives inexistantes, multi-pays hors pilote).
- Bannis aussi : gradients violets, grille 3-colonnes d'icônes en pastilles, tout-centré uniforme, bulles partout, CTA en gradient, hero stock-photo.

## Contraintes de marque (verrouillées)
- Voix **« vous »** partout (ADR-014 supersédé).
- Ne jamais dire « IA » sur les surfaces publiques (Ranti = sujet visible, IA sous le capot).
- Preuve **honnête** : jamais de faux témoignage, pas de copie de l'échelle Obligo (1M foyers). Ancre de confiance = quittance vérifiable + histoire pilote réelle.
- Tarif **unique** : « 3 mois gratuits, puis 5 % sur chaque paiement de loyer réussi » ; jamais de vocabulaire d'abonnement/résiliation.

## Composants (source unique)
- `components/ui/button.tsx` — `buttonClasses`/`Button` : primary (**olive, toujours** — l'encre n'est plus un fond de bouton d'action), secondary (outline), destructive, destructive-outline. Cible tactile ≥ 44 px (py-3).
- `components/ui/alert.tsx` — `Alert` : error / success / info / warning. Ne plus copier-coller de bannières.
- `components/ui/badge.tsx` — `badgeClasses`/`Badge` : neutral / success / accent / warning / error, forme pill unique.
- Montants : `lib/format.ts` uniquement (`formatFcfa` espace insécable **U+00A0** — pas U+202F, absente de l'encodage WinAnsi des polices PDF, s'imprimait « / » ; `formatFcfaNumber`, `formatFcfaSms` ASCII pour GSM-7). Ne jamais réécrire un formatteur local.

## Application (séquence, cf. design doc 2026-07-15)
1. **UI produit d'abord** (surface de conversion terrain n°1), landing ensuite — tokens partagés.
2. Auditer l'archi de style actuelle landing-vs-app (Tailwind partagé ou séparé ?) avant de promettre « une source de vérité ».
3. Illustration monoline + Figma = **étape 2 gatée** sur observation terrain + signal de demande.

## Decisions Log
| Date | Décision | Rationale |
|------|----------|-----------|
| 2026-07-15 | Système de design initial | /design-consultation ; boussole « fiable/sérieux » ; évolution de l'equity olive/cream/serif en prod, saut typo (Fraunces) + motif cachet certifié ; recherche obligo.com |
| 2026-07-16 | Mise en conformité post-critique | Token `--warning` câblé ; palette Tailwind brute éradiquée (dark mode réparé) ; olive dark aligné sur la spec (#aebd4a) ; primitives `components/ui` (Button/Alert/Badge) + `formatFcfa` unique ; CTA = olive partout ; eyebrows retirés des pages locataire ; cibles tactiles ≥ 44 px ; nav dé-pillée |
| 2026-07-17 | direction-artistique.html publiée, couleurs DA verrouillées **et appliquées partout** | Style-guide rendu depuis DESIGN.md + tokens prod (v0.3.26.0). Décision CEO : strictement les couleurs de la DA dans tout le projet — `globals.css` (light + dark DA), landing, manifest PWA, PDF quittance réalignés ; papier `#f7f7f2` référence, supersède le patch terrain `#f9f8f6` du 2026-07-16. Seule exception : couleurs officielles logo Google (OAuth) |
