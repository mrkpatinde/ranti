# Changelog

Toutes les évolutions notables de Ranti sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/) ; versions en `MAJOR.MINOR.PATCH.MICRO`.

## [0.3.32.0] - 2026-07-18

### Added

- **Les charges se relancent aussi** : le formulaire « Programmer une
  relance » propose, en plus des loyers impayés, les charges validées par le
  locataire (réparations, frais) des baux en impayé. Le message distingue
  toujours la nature de la dette ; une charge contestée ou pas encore validée
  n'est jamais proposée.
- **Ranti se présente au premier message** : le tout premier message envoyé à
  un locataire s'ouvre par une présentation (« Je suis Ranti, le registre de
  loyer qu'utilise votre propriétaire… vos paiements restent directs, Ranti ne
  touche jamais l'argent ») avant le rappel. Ensuite, messages habituels.

### Removed

- **Paiement par le rail** retiré des écrans (il reviendra dans une mise à
  jour) : plus de page Transactions ni de cartes « Paiements par le rail »
  dans Encaissements. La validation des charges par le locataire est
  inchangée.

## [0.3.31.0] - 2026-07-18

### Added

- **Programmer une relance** : depuis la page Relances, choisissez une
  échéance impayée, la date d'envoi (calendrier) et le canal ; Ranti l'envoie
  ce jour-là. Vos relances programmées s'affichent et restent annulables tant
  qu'elles ne sont pas parties.
- **Relancer maintenant** : sur chaque relance à venir, un bouton ouvre
  WhatsApp avec le message par défaut pré-rempli ; vous relisez et envoyez.

## [0.3.30.0] - 2026-07-18

### Added

- **Consentement à la quittance électronique** (conformité) : au premier accès
  à un lien de quittance, le locataire accepte explicitement « J'accepte de
  recevoir mes quittances de loyer au format électronique via Ranti. » avant
  tout affichage. L'accord est enregistré une seule fois par locataire,
  horodaté et immuable (le libellé accepté est archivé mot pour mot) ; il
  vaut pour toutes les quittances suivantes. Le PDF et les actions confirmer /
  contester sont soumis à la même porte, et la quittance n'est considérée
  remise qu'après l'accord.

## [0.3.29.3] - 2026-07-18

### Changed

- **Landing : un seul appel à l'action.** Le bouton « Commencer » du header
  est retiré ; « Se connecter » reste seul, et le grand « Commencer avec
  Google » du hero demeure l'unique CTA, visible sans scroller.

## [0.3.29.2] - 2026-07-18

### Added

- **Réglages de relance sur la page Relances** : le propriétaire choisit le
  canal (WhatsApp / SMS) et le moment privilégié (3 jours avant, le jour de
  l'échéance, en cas de retard), voit le message par défaut exactement tel
  qu'il sera préparé, et active ou coupe la relance automatique. Un
  calendrier « À venir » montre, par échéance, la prochaine fenêtre d'envoi
  (J-5, veille, jour J, J+3, J+10) avec le locataire, le logement et la date.

## [0.3.29.1] - 2026-07-18

### Changed

- **Un seul menu sur mobile** : le hamburger et l'avatar côte à côte faisaient
  doublon. Le menu unique porte désormais l'identité en tête (avatar, nom,
  « Propriétaire »), puis la navigation, l'aide, Paramètres et
  « Se déconnecter ». Appliqué à l'espace connecté (AppShell) et au parcours
  de prise en main (/first-run).

## [0.3.29.0] - 2026-07-18

### Added

- **Prise en main FirstRun câblée à la base** : `/first-run` derrière l'auth
  (`requireLandlordProfile`, redirige vers `/dashboard` si l'onboarding est
  terminé) avec l'identité réelle du bailleur. Le parcours guidé crée un vrai
  bail, valide un vrai paiement et édite une vraie quittance : server actions
  non-redirigeantes (`createBailFirstRun` via `bulk_onboard_portfolio`,
  `recordPaymentFirstRun` via `record_collection` + `confirm_collection` +
  `generate_receipt`), idempotence par `request_id`, reprise sûre après une
  coupure réseau (la même clé rejoue la même écriture). Statut d'onboarding et
  réglages de relance persistés (et resservis à l'ouverture), déconnexion
  Supabase réelle. Portage fidèle du prototype
  `design_handoff_first_run/` : coquille desktop/mobile, welcome, 4 vues,
  modales, tokens exacts, `prefers-reduced-motion`.
- **Modale bail complète** : lieu + ville, type de logement, prénom/nom,
  téléphone, date de début, avec bouton « Choisir dans les contacts »
  (Contact Picker, Android Chrome/Edge), aussi sur `/leases/new`.
- **Clause notariale de quittance** avec montant en toutes lettres
  (`amountInWordsFcfa`) et période nommée, identique sur les 4 surfaces :
  page publique `/recu/[token]`, PDF, page bailleur `/receipts/[id]`, modale
  FirstRun. Quittance = solde de la période ; reçu = paiement partiel.
- **Base de données** : colonnes de relance par bailleur (`reminders_enabled`
  / `reminder_channel` / `reminder_moment`, patron `onboarding_status`) ;
  référence de quittance `RNT-AAAA-NNNN` (séquence annuelle par bailleur,
  ex. `RNT-2026-0001`, sans plafond ; les existantes gardent `R-NNNNNN`).
- **CGU + confidentialité enrichies** (structure non-custodial, éditeur
  WI'SOFT SOLUTIONS) et mentions légales société dans le pied de page.

### Changed

- **Libellé locataire « Confirmer le paiement »** (au lieu de « la
  réception ») et message de confirmation unique après certification.
- **Identité légale unifiée** : WI'SOFT SOLUTIONS (RCCM, IFU) et un seul
  email de contact sur la landing, les CGU et la confidentialité.

### Fixed

- **Séquence RNT sans plafond** : la 10 000e quittance d'une année ne
  produit plus de collision (lpad tronquait), l'émission ne peut plus se
  bloquer. Appliqué en prod.
- **Fond clair partout** : le mode sombre système n'inverse plus l'app sur
  mobile (`design_handoff_first_run/` fait foi, palette crème seule) ;
  `--olive-deep` aligné sur le token exact du handoff.
- **Réseau instable** : une action qui échoue en pleine soumission ne fige
  plus les modales bail/paiement ; la saisie est conservée et le renvoi ne
  compte jamais un paiement deux fois.
- **Badge de quittance honnête** : « À confirmer » tant que le locataire n'a
  pas certifié (au lieu d'un « Confirmée » codé en dur).
- **Montants et mois uniformes** : formatage FCFA unique (espace insécable,
  plus de « / » sur PDF), mois accentués partagés, montant de paiement
  strictement numérique, tirets cadratins purgés des surfaces locataire.
- **Spec e2e landing réaligné** sur la landing DA (périmé depuis la refonte
  v0.3.27.0, référençait un tarif banni).

### Removed

- **Maquette publique `/first-run/quittance`** : fausse empreinte SHA-256 et
  faux « Lien vérifié » sur l'origine de prod ; la vraie page locataire vit
  sur `/recu/[token]`.

## [0.3.28.0] - 2026-07-18

### Added

- **Rail de la prise en main guidée** : `getGuidedRail` (helper serveur)
  combine le statut d'onboarding et la progression réelle en un modèle de rail
  — étape courante, position (« Étape N sur total »), prochaine cible et état
  de chaque étape (faite / active / verrouillée). Réutilise
  `getOnboardingProgress`, aucun état stocké. Composant `GuidedRail` : le
  stepper compact FirstRun (segments, position, CTA « Continuer » vers la
  prochaine cible), tokens sémantiques, jamais bloquant. Branché au tableau de
  bord en statut « guided » (dérivé de la progression déjà chargée, aucune
  requête en plus), sous la checklist « Premiers pas ».
- **Centre d'aide (handoff FirstRun)** : bouton « Centre d'aide » (barre
  latérale + menu mobile) ouvrant la modale « Aide Ranti » — guides du centre
  d'aide Notion et canaux directs (WhatsApp, email) en repli. URL Notion via
  `NEXT_PUBLIC_NOTION_HELP_URL` (facultative, le lien se masque si absente,
  comme WhatsApp). `aria-modal` avec focus à l'ouverture + restauration à la
  fermeture. Remplace les liens d'aide bruts de la barre latérale.

## [0.3.27.0] - 2026-07-17

### Added

- **Nouvelle landing (portage « Landing.html » du design system)** : wordmark
  animé « Ledger Draw », héro Fraunces, maquette du registre sur téléphone,
  « Comment ça marche » en trois gestes, FAQ native, fond atmosphérique
  (halos olive lents, grille de points — coupés sous reduced-motion). Tout en
  tokens sémantiques, zéro hex en dur (hors glyphe Google et bezel du mockup).
- **Consentement cookies (Axeptio)** : bandeau au chargement, réouverture des
  choix depuis la politique de confidentialité.

### Changed

- **Tarif ADR-024 sur toutes les surfaces publiques** : abonnement par
  paliers, **gratuit pour un logement**, aucune commission sur les loyers —
  landing, CGU et DESIGN.md réalignés ; le « 3 mois gratuits puis 5 % »
  disparaît (le rail d'encaissement reste gelé, pas supprimé).
- **Couleurs : direction-artistique.html fait foi, strictement, partout**
  (décision CEO). Light : papier crème `#f7f7f2`, surface atténuée `#f2f2ec`.
  Dark : palette sombre de la DA (papier `#17171a`, surface `#1f1f22`, encre
  `#eceae3`, olive `#aebd4a`). Landing, manifest PWA, PDF quittance et
  nouveaux sous-tons (olive-deep `#3f4d00`, chip, wash retard, filets)
  réalignés — plus aucune couleur hors palette dans le projet (seule
  exception : logo Google officiel). Supersède le patch terrain `#f9f8f6`.

## [0.3.26.0] - 2026-07-17

### Added

- **Prise en main guidée (prototype FirstRun, de bout en bout)** : à la
  première connexion, un accueil non bloquant propose de commencer la
  configuration ou de « Passer pour l'instant ». Le guidage affiche une
  checklist « Premiers pas » (bail → paiement → quittance → relance) dont la
  progression est **dérivée des données réelles** — jamais stockée ; chaque
  étape mène au vrai écran. Passer ouvre un tableau de bord vide honnête, et
  « Reprendre la prise en main » (barre latérale, menu mobile) relance le
  guidage à tout moment. Persistance via `landlords.onboarding_status`
  (colonne non-identité, update direct sous RLS — verrou ADR-002 intact).
- **Direction artistique** : `direction-artistique.html`, style-guide généré
  depuis `DESIGN.md` et les tokens prod — cachet certifié, typographie
  Fraunces/Hanken, palette clair/sombre, composants, interdits anti-slop.
- Docs : positioning, guide d'entretien diaspora, ADR-024 retour
  non-custodial/abonnement.

### Changed

- **Quittance côté locataire alignée sur le prototype** : en-tête marque +
  « Lien vérifié », accueil personnalisé tant que la confirmation est
  possible, bandeau confirmé olive avec coche, montant en Fraunces sur filet
  pointillé, CTA olive, états erreur/contestation sur tokens (plus de rouges
  en dur). Tous les états ADR-013 (lu / certifié / contesté / annulé)
  préservés ; montants via `formatFcfa` (source unique).

### Security

- **Moindre privilège `anon`** : retrait de tous les droits d'écriture
  directe (INSERT/UPDATE/DELETE/TRUNCATE…) du rôle `anon` sur les tables
  métier + default privileges verrouillés pour les futures tables. Les flux
  publics locataire (RPC `*_by_token` SECURITY DEFINER) sont inchangés.
  Appliqué en prod le 2026-07-17, test SQL rejouable inclus.
- Rapatriement de `ledger_notification_events` (appliquée en prod via MCP,
  absente du repo) — le repo redevient source de vérité du schéma.

## [0.3.25.0] - 2026-07-16

### Changed

- **Grand Livre, bascule des relances et de la fiche bail (ADR-023)** : plus
  de relance de retard pour un locataire à jour au compte courant. La file
  opérateur `ops_reminder_queue` porte une garde compte courant (les relances
  de retard ne sortent que si le bail a un impayé au grand livre — une avance
  affectée à un mois futur nette la dette ; les rappels pré-échéance sont
  inchangés), et la projection à l'écran applique exactement la même règle
  (dashboard « Relances à venir », garde-fou de silence de `/reminders`). La
  fiche bail affiche le solde du compte en tête — la même lentille que le
  dashboard, fini les écrans qui se contredisent — et la relance manuelle
  WhatsApp est sourcée du grand livre (montant = l'impayé du compte).

## [0.3.24.0] - 2026-07-16

### Added

- **Grand Livre, phase « différenciant » (ADR-023)** : les charges variables
  entrent au compte du bail, validées par le locataire. Le propriétaire
  ajoute une réparation ou des frais depuis la fiche bail (« Charges &
  frais ») ; la charge naît « en attente » avec un lien signé
  `/transaction/[token]` que le locataire ouvre sans compte pour **valider**
  (elle devient certaine et indélébile) ou **contester** (montant faux, dette
  non reconnue, déjà réglée, autre — sa version est conservée à côté, jamais
  écrasée) puis, s'il le souhaite, retirer sa contestation. Le propriétaire
  peut retirer une charge jamais validée (motif tracé dans l'historique) ou
  la corriger — la version corrigée repart pour validation avec un nouveau
  lien. Envoi du lien : bouton WhatsApp pré-rempli (le propriétaire relit et
  envoie) ; l'envoi automatisé passera par ranti-ops via la vue
  `ops_ledger_notifications` (contrat ADR-022). Création idempotente
  (double-tap réseau instable), RPC `SECURITY DEFINER` seules voies
  d'écriture, garde d'égalité restreinte à la projection héritée.

## [0.3.23.0] - 2026-07-16

### Changed

- **Grand Livre, phase « Nouvelle lecture » (ADR-023)** : le dashboard lit
  désormais le grand livre (vue `lease_balances`, module `lib/ledger`). La
  liste « À encaisser » devient une ligne **par bail** — dette consolidée en
  compte courant (une avance sur un mois réduit le dû ; un même locataire
  n'apparaît plus une fois par échéance), tuile « Retard » sourcée du grand
  livre, déclarations à confirmer et montants en litige visibles. Le chiffre
  rouge d'une ligne est l'impayé seul (la somme des lignes rouges recolle
  avec la tuile « Retard ») ; l'attendu est nommé à part, jamais fusionné.
  « À jour » signifie désormais bail actif sans dû ni attente ni litige
  (compte courant), plus « échéances du mois soldées ». « Payé / Attendu »
  et le taux de recouvrement restent des lentilles mensuelles
  (`rent_due_balances`), que la cadence des relances lit déjà (ADR-022) —
  limites connues de la coexistence documentées dans l'ADR-023.

## [0.3.22.0] - 2026-07-16

### Added

- **Grand Livre de Confiance, phase Expand (ADR-023)** : table `transactions`
  (compte courant locatif — loyers, réparations, frais, règlements,
  contre-passations) et vue `lease_balances` (solde certain / en attente /
  en litige / impayé, calculés en base). Les tables héritées restent la
  source de vérité : le grand livre est tenu à l'identique par triggers
  miroir (même transaction Postgres) et backfill idempotent, avec une garde
  d'égalité des soldes qui fait échouer la migration au moindre écart.
  Machine à états dure en base : une ligne validée est indélébile (toute
  correction est une contre-passation visible), une ligne retirée est
  terminale, rien ne se supprime. Aucun changement d'interface : la bascule
  des lectures viendra à la phase « Nouvelle lecture ».
- ADR-023 rédigée puis précisée (matrice de validation « qui rend quoi
  certain », cycle de vie du litige à quatre sorties, correspondance de
  backfill) ; `vision.md`, `architecture.md`, `domain-model.md`,
  `database.md` et `glossary.md` alignés sur le pivot.

## [0.3.21.1] - 2026-07-16

### Fixed

- Montants illisibles sur la quittance PDF (« 120/000/FCFA ») : le séparateur
  de milliers passait par l'espace fine insécable U+202F, absente de
  l'encodage WinAnsi des polices PDF de base (Helvetica) — l'octet tronqué
  s'imprimait « / ». `formatFcfa` utilise désormais l'espace insécable
  U+00A0, rendue correctement partout (écran, PDF, WhatsApp), sans casser
  l'invariant « le même montant s'écrit pareil sur tous les canaux ».
- Partage WhatsApp de la quittance (`/receipts/[id]`) : le lien `wa.me` sans
  numéro (mode « partager à… ») perdait souvent le message pré-rempli sur
  Android. Le lien cible désormais directement la conversation du locataire
  (téléphone du snapshot, même mécanique que le journal et les relances) ;
  repli sur le lien sans numéro si le locataire n'a pas de téléphone.
- Page publique du reçu (`/recu/[token]`) : après confirmation, le bandeau
  d'état et l'encadré « Merci… » répétaient le même message. Un seul bandeau
  reste ; son texte devient le remerciement juste après l'action (idem pour
  la contestation).
- Fond de page verdâtre en mode clair (retour terrain : « le dashboard est
  toujours en fond vert en journée ») : le crème `#f7f7f2` (teinte HSL 60,
  jaune-vert) virait au vert sur les dalles Android bas de gamme. Les fonds
  clairs passent sur des neutres chauds sans composante verte :
  `--background` → `#f9f8f6`, `--muted` → `#f2f0ee`, manifest PWA et landing
  alignés. Accent olive, `--secondary` (états) et dark mode inchangés.
  DESIGN.md mis à jour (palette Neutrals + mapping tokens).

## [0.3.12.0] - 2026-07-16

### Added

- Fiche bail `/leases/[id]` — relance manuelle « préparée » : bouton
  « Relancer sur WhatsApp » (bail actif + échéance non soldée) qui ouvre un
  message pré-rempli vers le locataire, adapté à l'état (rappel avant échéance
  vs relance de retard) et incluant le lien `/confirmer/[token]`. Envoi manuel
  par le propriétaire — zéro API, zéro coût, aucun envoi auto (ADR-006 nuance
  MVP ; même mécanisme wa.me que le journal). Complément de l'automatique.
  Builder pur `buildReminderWaLink` + tests.
- `roadmap.md` Sprint 7 : item « préparer le message… MVP prudent » coché.

### Changed

- Type `RentDue` : `confirmation_token` exposé (déjà renvoyé par la vue
  `rent_due_balances` via `d.*`), pour construire le lien de confirmation.

## [0.3.11.0] - 2026-07-16

### Added

- Dashboard — bloc « Relances à venir » (lecture seule) : pour chaque échéance
  impayée, la prochaine relance que Ranti enverra (ex. « Awa — Chambre 3 ·
  Rappel J-5 · 20 juil. »), triée par date, point accent/destructive selon
  retard. Microcopie « Ranti s'en charge — vous n'avez rien à envoyer »
  (ADR-006 : c'est Ranti, pas le propriétaire ; dashboard lecture seule
  ADR-020). Prochaine relance projetée depuis la cadence (fonction pure
  `computeUpcomingReminders`, miroir des fenêtres du cron), pas lue depuis
  `next_reminder_at` (maintenu par le cron SMS dormant). Tests.
- `roadmap.md` Sprint 7 : item « afficher les relances prévues/envoyées sur le
  dashboard » coché.

## [0.3.10.0] - 2026-07-16

### Added

- Fiche bail `/leases/[id]` — section « Rappels & relances » : le calendrier
  des rappels/relances que Ranti applique à partir de l'échéance (5 jours
  avant, la veille, le jour J, dès J+3, à J+10), en lecture seule (miroir des
  fenêtres du cron). Exigence ADR-006 (« la fiche bail doit afficher les règles
  de rappel et relance »). Affiché en brouillon (« à l'activation ») et actif ;
  canal-agnostique (pas de promesse SMS tant que l'envoi réel reste
  WhatsApp/ops). L'historique envoyé passe sous « Envoyées ». Fenêtres fixes,
  non configurables au MVP.
- `roadmap.md` Sprint 7 : item « afficher les règles sur la fiche bail » coché.

## [0.3.9.0] - 2026-07-16

### Added

- Fiche bail `/leases/[id]` — section « Relances » : le fil des relances déjà
  envoyées à ce locataire (fenêtre J-5…J+10, canal SMS/WhatsApp, date, statut),
  filtré sur les échéances du bail. Relie « retard » et « relances » au même
  endroit de gestion (Sprint 6 complété). Query `getLeaseReminders`.

### Changed

- Fiche bail — les échéances passent sur `rent_due_balances` : affichent le
  montant restant réel quand une échéance est partiellement payée.
- Libellés de relance extraits dans `lib/reminders/labels.ts`, partagés entre
  `/reminders` et la fiche bail ; fusion auto+ops factorisée
  (`mergeReminderRows`).
- `roadmap.md` : Sprint 6 marqué complété (retards/relances visibles).

## [0.3.8.0] - 2026-07-16

### Added

- Dashboard — taux de recouvrement du mois : « Recouvrement de {mois} — X % »
  + barre fine sous les tuiles. Part du loyer DÛ du mois déjà encaissée
  (`payé / monthDue`), entier borné 0–100, floor (jamais « 100 % » tant qu'il
  reste 1 FCFA), masqué si aucune échéance ce mois. `buildDashboardSummary`
  étendu (`monthDue` + `collectionRate`) + tests.

### Changed

- Dashboard — unité FCFA affichée sur les tuiles Payé/Attendu/Retard et sur
  les montants de la liste « à encaisser » (montants jusque-là ambigus).
- `roadmap.md` Sprint 6 : synthèse mensuelle du dashboard marquée livrée
  (docs en retard sur le code).

## [0.3.7.0] - 2026-07-16

### Added

- Changement de statut d'un logement enfin exposé : toggle disponible/occupé
  sur `/units/[id]` (câble `setUnitAvailability`, jusque-là exportée sans aucun
  appelant UI ; la notice `availability_updated` était déjà prête).

### Changed

- Archivage (action destructive) harmonisé sur les trois entités (logements,
  lieux, locataires), aligné sur le pattern des baux :
  - nouveau composant client `ConfirmArchiveButton` (`window.confirm`, server
    action passé en prop pour garder `lib/supabase/server` hors du bundle
    client), tokens `destructive` (DESIGN.md, plus de `red-*` en dur) ;
  - retrait du reveal caché `<details>` sur logements/locataires (ADR-020 :
    « jamais de reveal caché ») ; les lieux passent de l'archivage direct sans
    garde-fou à un panneau visible + confirmation ; explication d'archivage
    rendue visible partout.
- `roadmap.md` (Sprint 3/4/6) mis à jour : les écrans modifier/archiver des
  trois entités étaient déjà livrés (docs en retard sur le code) ; cases
  cochées, statut logement inclus.

## [0.3.6.0] - 2026-07-16

### Added

- Rail FeexPay branché côté serveur (ADR-019, cash-in unique) — **sandbox
  uniquement**, activation prod toujours gatée BCEAO. Client isolé
  `src/lib/feexpay/` : `config` null-safe (sandbox/live, secrets serveur
  uniquement), `signature` (HMAC-SHA256 corps brut, temps constant), `normalize`
  (webhook → event), `checkout` (cash-in plein montant), `payout` + polling V2,
  `http` (transport authentifié → `PaymentError`). Tests signature +
  normalisation.
- `/collections` : carte de validation des paiements du rail en `pending` →
  « Valider et générer la quittance » (`verifyPaymentTransaction`, ADR-017) ;
  paiements rejetés en repli tracé. Notices `payment_transaction_verified` /
  `payment_transaction_rejected`.
- `/transactions` : vue ledger propriétaire (lecture seule), tous statuts
  (à valider / validé / reversé / non validé) + total net reçu. Découvrable
  depuis `/collections`, sans nouvelle tuile de nav (minimalisme ADR-020).
  Vision propriétaire conforme `DESIGN.md` : « net reçu · frais de service
  Ranti 5 % tout inclus », jamais les coûts PSP.
- ADR-021 (Proposée) : reçus locataire (rail vs PSP) + décision requise sur le
  montage wallet FeexPay (unique Ranti vs sous-comptes par propriétaire, reco
  sous-comptes) — prérequis de la copie `/confirmer` et de la levée du gate
  BCEAO.

### Changed

- Webhook `POST /api/payments/notification` re-câblé de Kkiapay vers le rail
  FeexPay (secret `FEEXPAY_WEBHOOK_SECRET`, en-tête `x-feexpay-signature`,
  provider `feexpay`). Contrat inchangé : ingestion idempotente en `pending`,
  validation propriétaire (ADR-017) inchangée, réponses 200/400/401/500
  identiques.
- `TODOS.md` / `roadmap.md` alignés sur le rail FeexPay (sandbox FedaPay
  périmé ; montage wallet renvoyé à ADR-021).

### Removed

- Code Kkiapay devenu orphelin après le re-câblage : `src/lib/kkiapay/`,
  `normalizeKkiapayPayload` (+ type `NormalizedKkiapayEvent`) et leurs tests.
  L'enum ledger `PaymentProvider` conserve `kkiapay`/`fedapay` (valeurs
  valides de la colonne `payment_transactions.provider` en base — historique).

## [0.3.5.2] - 2026-07-16

### Removed

- Saisie assistée retirée du code (ADR-019 : le rail FeexPay est l'unique
  chemin d'encaissement ; collage SMS et vocal abandonnés) : composants
  dashboard `sms-ingestion-zone` / `voice-capture` / `validation-bottom-sheet`
  (orphelins depuis le dashboard v2), routes `/api/sms/collection` et
  `/api/voice/collection`, modules `lib/sms` et `lib/voice` (Gemini), et le
  bloc `recordSmsCollection` de `lib/collections/actions.ts`. −1 500 lignes,
  plus aucune dépendance Gemini. PR #141 rebasée (l'ADR-019 de main, livrée
  en v0.3.4.7, fait autorité — seul le retrait de code est repris).

## [0.3.5.1] - 2026-07-16

### Fixed

- Encaissement : le registre rejoint enfin la prod. Le grant `execute` sur les
  fonctions `private.*_core` (record/confirm/receipt) — appliqué en urgence en
  prod le 2026-07-10 (migration `20260710142437`) après 5 jours d'encaissement
  cassé — entre dans le repo (PR #103 rebasée). Observabilité ajoutée : les
  erreurs RPC non mappées des encaissements sont désormais loggées côté serveur
  au lieu de disparaître dans le message générique.
- Test garde-fou `collection_grants_as_authenticated.test.sql` : parcours
  complet encaisser → confirmer → quittance sous le rôle `authenticated`
  (les tests en `postgres` contournent les grants — leçon des 5 jours de
  panne) ; sélection d'échéance par solde restant pour rester vert quelles
  que soient les données.

## [0.3.5.0] - 2026-07-16

### Security

- ADR-002 implémenté — identité propriétaire verrouillée en base (migration
  `20260716070000`). Un propriétaire authentifié pouvait réécrire son propre
  nom/civilité/téléphone directement en DB (« verrouillé en UI, modifiable en
  DB = fausse sécurité », dernier P0 ouvert de l'audit 2026-07-15) :
  - Trigger `BEFORE UPDATE` `private.enforce_landlord_identity_lock`
    (`SECURITY INVOKER` — observe le `current_user` réel) : rejette
    nom/civilité depuis les rôles clients, et tout changement de téléphone
    inconditionnellement (identifiant de connexion, flux de re-vérification
    dédié à concevoir avant toute réouverture).
  - Seul chemin légitime : RPC `public.update_landlord_identity(first, last,
    civility, reason)` (`SECURITY DEFINER`), motif obligatoire, `audit_logs`
    écrit dans la même transaction (ADR-006), pas de paramètre `landlord_id`
    (aucune écriture cross-tenant possible).
  - Grant `UPDATE` table de `authenticated` intact (payment_alias + archive) ;
    test garde-fou `supabase/tests/landlord_identity_lock.test.sql`
    (6 sections, rejouable, rollback-wrapped).

## [0.3.4.9] - 2026-07-16

### Fixed

- Unicité du nom de logement par lieu enfin imposée en base : index unique
  partiel `units(property_id, lower(btrim(name)))` hors logements archivés
  (migration `20260716090000`). Les deux mappings « un logement porte déjà ce
  nom dans ce lieu » (création bail, édition logement) reposaient sur une
  contrainte qui n'existait pas — les homonymes passaient silencieusement.
- Collision d'errcode `P0001` dans `bulk_onboard_portfolio` : un problème de
  lieu affichait « Ajoutez au moins un logement ». Les erreurs de forme du lieu
  passent sous `PR400` ; `P0001` ne signifie plus que `no_rows`. `mapRpcError`
  gagne le cas `PR400` et aligne le wording (« ce lieu », « Lieu introuvable »).

### Docs

- Audit sécurité de la couche d'isolation propriétaire
  (`docs/security-audit-2026-07-15.md`) : lecture/insert/update cross-tenant
  prouvés bloqués sur les 4 tables métier ; écart ADR-002 signalé comme P0
  séparé. Test négatif rejouable `supabase/tests/cross_tenant_isolation.test.sql`
  (rollback-wrapped), lignes ledger alignées sur le schéma TVA courant.

## [0.3.4.8] - 2026-07-16

### Changed

- Wording de la page alias (`/settings/payment`) aligné sur ADR-019 : retrait du
  claim « Ranti affiche l'alias mais ne touche jamais l'argent » (position
  abandonnée comme cible produit — le rail FeexPay fait entrer Ranti dans le flux
  d'argent). On garde ce qui reste vrai dans les deux modèles : paiement en un
  instant et **sans frais pour le locataire**. Glossaire « Alias PI-SPI » complété :
  l'alias est désormais le filet de repli, le rail FeexPay est la cible (gatée
  BCEAO). Aucune mention de FeexPay comme actif : le rail n'est pas branché.

## [0.3.4.7] - 2026-07-16

### Docs

- ADR-019 « Rail FeexPay obligatoire (cash-in unique) » consignée : formalise la
  décision CEO du 2026-07-15 (FeexPay = PSP retenu ; rail = seul chemin
  d'encaissement, 0 surcharge locataire, 95 % net reversé ; fractionné, collage
  SMS et vocal abandonnés ; alias PI-SPI en filet). Supersède ADR-012/ADR-014,
  amende ADR-009/ADR-018. Activation prod gatée BCEAO. Aucun changement de code —
  mise au clair de la base avant d'aligner le wording de l'app.

## [0.3.4.6] - 2026-07-15

### Fixed

- Badge de statut « Attendu » (échéances de loyer) et encadrés info sur fond
  `bg-accent/10` : le texte utilisait `text-accent-foreground`, une couleur
  prévue pour le texte sur olive plein (encre #1e1e1e en dark, crème #fcfcf8 en
  clair). Sur fond olive à 10 % il devenait invisible dans les deux thèmes
  (encre sur noir / crème sur blanc). Passé à `text-accent` (olive, adapté au
  thème) → lisible en clair comme en sombre. Corrige aussi 5 encadrés info
  (paiement, profil, collections, onboarding) qui avaient le même défaut.

## [0.3.4.5] - 2026-07-15

### Changed

- CTA principales en pill à gauche sur desktop (comme le dashboard) : les
  boutons d'action et de soumission (« Créer un bail », « Enregistrer »…) qui
  s'étiraient en barre pleine largeur dans les pages en `flex-col` prennent
  désormais leur largeur de contenu au-delà de `lg` (`lg:w-fit`), alignés à
  gauche. Mobile inchangé (pleine largeur, thumb-friendly).

## [0.3.4.4] - 2026-07-15

### Changed

- Propagation de la composition desktop éditoriale (« refonte Granola ») à
  toutes les pages de l'app : respiration verticale au-delà de `lg` (`lg:py-14`
  sur les conteneurs) et titres à l'échelle éditoriale (`lg:text-4xl`, détails
  `lg:text-3xl`, Fraunces) sur Encaissements, Relances, Baux, Lieux, Logements,
  Locataires, Reçus, Paramètres et les écrans créer/éditer. Les pages liste
  gardent leur largeur confortable (`max-w-3xl`), les formulaires restent
  étroits (`max-w-md`). Rendu mobile inchangé (variantes `lg:` uniquement).

## [0.3.4.3] - 2026-07-15

### Changed

- Dashboard desktop en composition éditoriale (référence « refonte Granola ») :
  la colonne passe d'une largeur téléphone (448 px) à une colonne centrée
  confortable (672 px) au-delà de `lg`, avec un « Bonjour » agrandi (Fraunces),
  une carte de stats focale (grands chiffres), des lignes « à encaisser » plus
  aérées, et un CTA « Créer un bail » en pill à gauche plutôt qu'une barre
  pleine largeur. Le vide autour lit désormais comme du calme, plus comme de
  l'inachevé. Le rendu mobile est inchangé (variantes `lg:` uniquement). Les
  autres pages suivront ce même système.

## [0.3.4.2] - 2026-07-15

### Changed

- Bouton **retour** dans le header mobile (chevron ‹ à gauche de « Ranti »,
  masqué sur l'accueil) : revient à la page précédente, avec repli sur l'accueil
  si on a atterri directement sur une page profonde. Répond au besoin de
  navigation arrière sur mobile.

### Fixed

- « Ranti » n'apparaît plus deux fois en haut des pages : la ligne « Ranti » des
  en-têtes de page (Encaissements, Relances, Baux, Bail, Logement, Lieu,
  Locataire, Reçus, Paramètres…) est retirée — le shell l'affiche déjà. La
  marque « Ranti » du document de quittance reste, elle, intacte.

## [0.3.4.1] - 2026-07-15

### Changed

- Navigation mobile rangée : la barre d'onglets (Accueil / Encaissements /
  Relances / Baux) qui débordait est repliée dans un bouton menu en haut à
  droite ; à côté, l'avatar profil ouvre **Paramètres** et **Se déconnecter**
  (déconnexion rouge, visible d'un tap). Le bouton « Paramètres » séparé et le
  menu compte propre au dashboard disparaissent — un seul profil, présent sur
  toutes les pages. La barre latérale desktop est inchangée.

## [0.3.4.0] - 2026-07-15

### Changed

- **Dashboard propriétaire en lecture seule (ADR-020, ADR-019)** : l'accueil
  répond à « qui a payé / qui doit » et rien d'autre. Trois totaux (payé /
  attendu / retard), la liste « à encaisser » (retards d'abord, chaque ligne
  ouvre le bail), le compteur de locataires à jour, et une seule action :
  « Créer un bail ». Fini la saisie sur l'accueil : l'encaissement passe par le
  rail FeexPay (ADR-019).
- **Onboarding recentré sur le bail** : un écran unique « Créer un bail » (lieu,
  logement, occupant et loyer en un geste) génère les échéances aussitôt. La RPC
  `bulk_onboard_portfolio` accepte désormais le lieu en ligne (nouvelle
  signature, ancienne supprimée dans la même migration).

### Removed

- Blocs de capture de l'accueil : « Déclarer à la voix » (vocal) et « Coller un
  SMS de paiement », ainsi que le journal chronologique en page d'accueil —
  remplacés par le tableau lecture seule (ADR-019 retire vocal + SMS).
- Écrans de création autonomes (lieu / logement / locataire séparés) et les
  server actions orphelines correspondantes : le bail est l'entrée de création
  unique.

## [0.3.3.1] - 2026-07-15

### Changed

- Copie de la landing en voix propriétaire, sans ponctuation « générée » : la
  phrase d'accroche devient « Vous encaissez le loyer. Ranti édite la
  quittance, votre locataire la confirme. » (plus de tiret cadratin). Sous le
  document, la légende invite à l'inscription : « La vôtre vous attend. Créer
  votre compte » pointe désormais vers `/signup` (au lieu de la vérification
  du document). Le document lui-même reste cliquable vers sa vérification.

## [0.3.3.0] - 2026-07-15

### Changed

- Landing minimale : la page d'accueil se réduit à un titre, une phrase, un
  bouton « Gérer vos loyers » — et le produit lui-même : la quittance. Le
  visuel n'est pas une maquette mais le vrai document `ReceiptPdf` rendu avec
  les données de démonstration de `/verifier/demo` (n° RNT-2026-DEMO),
  filigrané « SPÉCIMEN — SANS VALEUR PROBANTE » pour rester sans valeur pour
  un faussaire hors-ligne. Cliquer le document ouvre sa vérification en ligne.
  Le tarif verrouillé (« 3 mois gratuits, puis 5 % sur chaque paiement de
  loyer réussi ») reste visible sous le bouton.

### Removed

- Sections « Fonctionnement », « Preuve », tarif détaillé, FAQ et second appel
  à l'action de la landing — le document parle à leur place. Les animations
  correspondantes (`lp-roll`, `lp-paste`, `lp-slide-in`) disparaissent du CSS.

### Added

- Script `apps/web/scripts/generate-demo-quittance.tsx` : regénère l'image de
  la quittance de démonstration depuis le vrai composant PDF (recadrage sur le
  contenu + filigrane spécimen, dates en UTC).

## [0.3.2.2] - 2026-07-15

### Added

- Split fiscal (TVA 18 %) de la commission « 5 % tout inclus » sur le ledger
  des paiements. Chaque ligne archive `commission_ht` + `tva_amount`
  (= `service_fee`, taux `tva_rate_bp` archivé par ligne) : arrondi entier
  XOF (`floor` sur le HT, la TVA absorbe le reste — jamais sous-évaluée),
  somme exacte garantie par contraintes `CHECK`. Vision comptabilité, invisible
  du propriétaire (grants par colonne) : l'écran ne montre que le net et
  « Frais de service Ranti (5 % tout inclus) ». Nouvelle signature
  `private.compute_transaction_details` (5 paramètres, ancienne supprimée dans
  la même migration) ; `ingest_payment_notification` archive le split.
  Fonctionnalité dormante (rail Kkiapay bloqué juridique BCEAO — sandbox
  uniquement).

## [0.3.2.1] - 2026-07-15

### Changed

- Développement uniquement : en mode auth locale (`RANTI_LOCAL_AUTH`, jamais en
  production), le client Supabase serveur forge un jeton `authenticated` signé
  avec le secret JWT du stack local. Les écrans authentifiés (dashboard,
  journal) se rendent enfin en local et en QA/e2e, avec la RLS respectée (pas
  de contournement). Aucun effet en production : triple garde
  (`NODE_ENV ≠ production` + flag + secret présent).

## [0.3.2.0] - 2026-07-15

### Changed

- Application du système de design (`DESIGN.md`) à toute l'app : les 51 petits
  intitulés en majuscules espacées (« À FAIRE », « AIDE »…) disparaissent des
  31 écrans — les titres et labels se lisent en casse normale, plus rien qui
  fait « généré ».
- Les chiffres de l'app (montants, colonnes) s'alignent : figures tabulaires
  activées sur toute l'interface produit — un registre se lit d'un coup d'œil.
- `DESIGN.md` réaligné sur la réalité en production : Hanken Grotesk (corps) au
  lieu d'Instrument Sans, police mono système, et note sur les tokens couleur
  sémantiques déjà en place. La police d'affichage reste Fraunces.

## [0.3.1.3] - 2026-07-15

### Changed

- Les petits intitulés en majuscules au-dessus des titres (« Simple au
  quotidien », « Tarif », « Questions fréquentes ») disparaissent — le titre
  porte seul. La section tarif gagne deux lignes plus directes : « Le meilleur
  outil, c'est celui qu'on oublie » et « Si vous ne gagnez rien, nous ne
  gagnons rien ». Aucune promesse nouvelle : rien encaissé, rien à payer.
- `DESIGN.md` fixe désormais une règle explicite contre ces intitulés et
  contre tout élément fabriqué (faux témoignages, chiffres inventés, promesses
  non tenues).

## [0.3.1.2] - 2026-07-15

### Changed

- L'offre affichée devient « 3 mois gratuits à l'ouverture de votre registre,
  puis 5 % sur chaque paiement de loyer réussi » — le framing « gratuit
  pendant le pilote » disparaît. L'arrêt est libre et dit sans vocabulaire
  d'abonnement : « Vous arrêtez quand vous voulez », rien à résilier, vos
  baux et quittances restent à vous (nouvelle entrée FAQ « Combien ça
  coûte ? »).

## [0.3.1.1] - 2026-07-15

### Changed

- Tarif affiché comme unique et sans option : « 5 % sur chaque paiement de
  loyer réussi » — la FAQ ne présente plus l'encaissement comme un choix, et
  les mentions « sans carte bancaire », « aucune carte demandée » et « pas de
  paiement encaissé, pas de commission » disparaissent de la landing.

## [0.3.1.0] - 2026-07-15

### Security

- Une notification de paiement rejouée avec la même référence mais un montant
  ou un bail différent est désormais refusée (`reference_conflict`) au lieu
  d'être absorbée en silence : le registre d'origine fait foi et l'anomalie
  (référence recyclée, bug amont, tentative d'empoisonnement) devient visible.
- La lecture comptable interne du ledger (`service_role`) repose sur un
  privilège explicite et testé, plus sur les réglages par défaut de la base.
- Le garde-fou anti-fuite passe en liste blanche stricte : exactement les
  16 colonnes de la vision reçu sont lisibles par un propriétaire connecté —
  une colonne en plus (coûts PSP, marge, payload) ou en moins fait échouer
  la suite SQL.

### Fixed

- Un taux de service supérieur à 100 % est refusé des deux côtés (TypeScript
  et SQL) : au-delà, le net devenait négatif et les deux calculs pouvaient
  diverger d'un franc.

### Changed

- ADR-018 : les passages du modèle v3 (3 %, deux composants) sont marqués
  supersédés par le modèle « All-Inclusive 5 % » (v4) ; la décision sur les
  replays divergents y est documentée.

## [0.3.0.0] - 2026-07-15

### Added

- Page de vérification de démonstration `/verifier/demo`, liée depuis la
  landing : chacun peut voir à quoi ressemble le contrôle public d'une
  quittance avant de créer un compte. La page s'annonce clairement comme un
  exemple (« sans valeur probante », numéro fictif `RNT-2026-DEMO`) — une
  fausse quittance ne peut pas s'appuyer sur elle pour paraître authentique.
- Section « Tarif » sur la landing : 5 % tout compris, uniquement sur les
  loyers encaissés via Ranti (100 000 F → 5 000 F de frais, 95 000 F reversés).

### Changed

- Refonte de la landing : voix « vous » sur toute la page (supersède la voix
  « je » d'ADR-014), héro recentré sur « Le registre de loyer des
  propriétaires africains », nouvelle section « Preuve » (quittance numérotée,
  confirmée par le locataire, vérifiable par lien public), fonctionnement en
  trois étapes resserrées ; les piliers et le tableau comparatif disparaissent.
- Le badge de confiance du héro devient « Ranti ne détient jamais vos fonds »,
  exact dans les deux modes de paiement (direct ou encaissement via le
  partenaire agréé) et aligné sur la FAQ.
- La FAQ « Ranti encaisse-t-il l'argent ? » présente désormais les deux modes ;
  réponses FAQ en 16 px pour la lecture mobile.
- La description du site (résultats de recherche, partages) adopte la même
  voix et le même positionnement que la nouvelle landing.

## [0.2.0.0] - 2026-07-14

### Changed

- Modèle économique « All-Inclusive 5 % » (ADR-018 v4) : le propriétaire voit
  désormais une commission unique de 5 % tout compris et reçoit 95 % du loyer
  — les frais du PSP ont disparu de son reçu, ils deviennent des dépenses
  internes de Ranti.
- Rentabilité en temps réel : chaque transaction porte sa marge nette
  (`net_margin` = commission − coût d'encaissement sur le brut − coût de
  reversement sur le net), calculée en entiers FCFA et verrouillée par
  contraintes. Une marge négative est une information de pilotage, pas une
  erreur. PSP retenu : FeexPay (décision CEO) — taux archivés par ligne, un
  changement de prestataire n'altère pas l'historique.
- `calculateTransactionDetails(grossAmount)` (TS) remplace `calculatePayout`,
  miroir exact du calcul SQL, et retourne les deux visions (reçu + compta).

### Security

- Les deux visions sont séparées **en base** par des privilèges au niveau
  colonne : un propriétaire connecté ne peut pas lire la marge de Ranti ni
  les coûts PSP (`permission denied` testé sous le rôle `authenticated` dans
  la suite SQL, en plus des assertions de privilèges).
- La migration refuse de s'appliquer si le ledger contient déjà des lignes
  (le reshape suppose une table vide — garde fail-fast).

## [0.1.0.1] - 2026-07-14

### Changed

- Landing : la ligne « Cosme D. » de la carte hero rejoue en boucle le moment
  magique du produit — « SMS MoMo collé… » devient « Déclaré » (animation CSS,
  figée sur l'état final en `prefers-reduced-motion`).
- Landing : la section « Pourquoi Ranti » devient la preuve sociale honnête du
  pilote — pas de faux témoignages : une quittance certifiée, numérotée et
  vérifiable par lien public, avec la mention « leurs mots arriveront ici —
  pas avant ».
- Landing : badge « Ranti ne touche jamais mon argent » remonté dans le hero ;
  piliers et étapes resserrés (3 étapes au lieu de 5).
- Nettoyage : variante `declared` de StatusBadge devenue morte, supprimée ;
  dernier warning lint (variable inutilisée dans un test) corrigé.

## [0.1.0.0] - 2026-07-14

### Added

- Cœur transactionnel PSP (ADR-018) : le loyer peut désormais être encaissé via
  un agrégateur de paiement agréé (recommandation FedaPay après étude
  comparative), avec un ledger `payment_transactions` qui trace chaque
  notification de paiement — même les montants inattendus, enregistrés
  `rejected` et jamais perdus.
- Webhook `POST /api/payments/notification` signé HMAC-SHA256, idempotent :
  rejouer une notification ne crée jamais de doublon, et un événement que le
  PSP annonce lui-même en échec est ignoré sans écriture.
- Validation par le propriétaire : une transaction ingérée reste `pending`
  jusqu'à sa validation, qui déclenche atomiquement réception, confirmation et
  quittance via le pipeline existant. Un propriétaire ne peut pas valider la
  transaction d'un autre.
- Reversement tracé : statut `paid_out` horodaté quand le net (97 %) est
  reversé au propriétaire.
- Frais serveur inviolables : 1,8 % PSP + 1,2 % Ranti = 3,0 %, calculés en
  entiers FCFA (floor par composant, le total balance toujours), taux archivés
  sur chaque ligne — un changement de tarif futur n'altère pas l'historique.
- Module `calculatePayout` (TS) miroir du calcul SQL, et intégration PSP isolée
  dans `src/lib/kkiapay/`.

### Fixed

- Encaissement cash réparé : la surcharge 7 arguments de `record_collection`
  rendait l'appel du formulaire propriétaire ambigu (erreur 42725 vérifiée en
  prod) — supprimée, le défaut `p_reference` couvre tous les appels.
- Divergence prod/local des privilèges : grants explicites (tables +
  fonctions) pour `authenticated` et `service_role` — le flux propriétaire et
  le cockpit ops fonctionnent désormais sur un stack local durci, et la prod
  ne dépend plus des défauts legacy. Tests d'assertion + smoke sous
  `set local role` dans la suite SQL.
- Calcul des frais en `bigint` intermédiaire : un loyer au-delà de ~11,9M FCFA
  ne provoque plus d'overflow int4 (parité TS/SQL assertée des deux côtés).

### Changed

- Politique statut du webhook : seul un échec PSP explicite est ignoré ; tout
  autre statut (succès, inconnu, absent) est ingéré `pending` et arbitré par
  le propriétaire — un paiement réel au vocabulaire imprévu n'est jamais
  perdu derrière un 200 non rejoué.
- `rent_receptions.recorded_by` accepte la nouvelle origine `psp` ; les
  surcharges SQL ambiguës (`record_collection_core` 10 args,
  `record_collection` 7 args) et `public.current_landlord_id()` orpheline
  sont supprimées.
- Index du ledger : composite `(landlord_id, created_at desc)` pour la vue
  propriétaire, FK `rent_reception_id` indexée ; lecture ledger bornée à 200.
- ADR-009 (alias P2P) partiellement supersédé et ADR-017 (notifications
  serveur) concrétisé par l'ADR-018 v3 ; `docs/database.md` et
  `docs/roadmap.md` à jour.

### Security

- Écritures du ledger uniquement via RPC `SECURITY DEFINER` (webhook et ops en
  `service_role`, validation propriétaire avec garde d'appartenance) ; aucune
  écriture cliente directe ; assertions de GRANTs dans la suite SQL.
- Le webhook ne révèle plus l'état de sa configuration (noms d'env vars) à un
  appelant non authentifié, et sa réponse n'expose que des champs explicites.
- Invariant testé : les cœurs `private.*_core` accordés à `authenticated`
  restent `SECURITY INVOKER` (la RLS est leur seule garde d'appartenance).
- ⚠️ Activation production bloquée sur validation juridique BCEAO (caveat
  ADR-018) — sandbox uniquement.
