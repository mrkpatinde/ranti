# Design System — Ranti

> Source de vérité visuelle. Lire avant toute décision UI. Ne pas dévier sans validation explicite.
> Créé par /design-consultation le 2026-07-15. Boussole : **« Ça, c'est fiable / sérieux »** — sérieux tranquille, la quittance fait foi, rien ne clignote.

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
- **Display/Hero :** Fraunces — serif old-style variable (opsz+wght), chaleur + gravitas. Remplace l'ancien `font-display` anonyme. Poids 500 (sous-titres) à 700 (héro).
- **Body / UI :** Instrument Sans — humaniste, du caractère, bonne lisibilité. Swap sécurité si lisibilité Android bas de gamme maximale requise : Source Sans 3.
- **Data / Tables (ledger) :** Instrument Sans avec `font-variant-numeric: tabular-nums` — colonnes FCFA alignées. Obligatoire sur tout montant.
- **Code / références :** JetBrains Mono — références PSP, SMS Mobile Money collé, numéros de transaction.
- **Loading :** Google Fonts (`Fraunces`, `Instrument Sans`, `JetBrains Mono`) ou self-host ; `display=swap`.
- **Scale (rem, base 16px) :** hero clamp(2.5,7vw,4.75) · h2 2.25–3 · h3 1.375 · lede 1.1875 · body 1 · small 0.875 · micro 0.75. Line-height : titres 1.05, corps 1.55.

## Color
- **Approche :** restreinte. L'olive est l'equity de marque — chaud, terre/CFA, africain, démarque du bleu fintech générique.
- **Primary :** `#5b6f00` (olive) — CTA, liens, marque. Accent vif : `#788c15`.
- **Secondary / signaux :** `#94f27f` (feuille) = authentifié/confirmé (quittance, badge « ne détient jamais vos fonds »).
- **Neutrals :** papier `#f7f7f2` · surface `#ffffff` / `#fcfcf8` · encre titres `#211f1c` · corps `#292929` · muted `#72726e` · filets `#e4e3db` / `#d5d5d2`.
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

## Application (séquence, cf. design doc 2026-07-15)
1. **UI produit d'abord** (surface de conversion terrain n°1), landing ensuite — tokens partagés.
2. Auditer l'archi de style actuelle landing-vs-app (Tailwind partagé ou séparé ?) avant de promettre « une source de vérité ».
3. Illustration monoline + Figma = **étape 2 gatée** sur observation terrain + signal de demande.

## Decisions Log
| Date | Décision | Rationale |
|------|----------|-----------|
| 2026-07-15 | Système de design initial | /design-consultation ; boussole « fiable/sérieux » ; évolution de l'equity olive/cream/serif en prod, saut typo (Fraunces) + motif cachet certifié ; recherche obligo.com |
