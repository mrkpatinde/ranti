# Ranti — Build Status

Dernière mise à jour : 2026-07-03 (corrections P0/P1 post-review)

> ⚠️ Note 2026-07-16 : les sections sur le cron SMS `/api/cron/reminders`
> (`CRON_SECRET`, `REMINDERS_SMS_ENABLED`, Africa's Talking) sont OBSOLÈTES —
> le chemin SMS a été supprimé et l'envoi des relances est opéré par ranti-ops
> (WhatsApp). Voir ADR-022.

## 1. Ce qui a été trouvé

Le produit est cohérent avec la vision : registre de loyer pour propriétaires,
français d'abord, mobile d'abord. La boucle cœur est implémentée de bout en
bout (UI + DB + RLS) :

propriété → logement → locataire → bail → échéances → encaissement →
quittance PDF → relance SMS → confirmation locataire.

- Build Next.js : OK. Tests unitaires : 117/117. Lint : 0 erreur.
- Docs (vision, ADR-001 à 006, roadmap) alignées avec le code.
- RLS multi-propriétaire uniforme via `private.current_landlord_id()`.
- Invariants financiers (branche `stabilize/p0-invariants`) : échéances non
  réécrivables si liées à un paiement, correction de quittance par
  remplacement (jamais de suppression), audit transactionnel fail-closed.

## 2. Incohérences détectées (et corrigées le 2026-07-02)

1. **Relances mortes en production (P0).** Le cron `/api/cron/reminders` et la
   page publique `/confirmer/[token]` utilisaient le client Supabase
   anonyme/cookies. Sans session, RLS renvoyait zéro ligne : le cron
   n'envoyait jamais rien, la page locataire affichait toujours « introuvable ».
2. **Aucun déclencheur cron.** Pas de `vercel.json` → la route relance n'était
   jamais appelée.
3. **Fenêtres de relance fausses.** Un loyer en retard de 1–2 jours recevait le
   SMS « dû demain » (`j-1`).
4. **Message j+3/j+10 :** recevait la date d'échéance au lieu du mois concerné.
5. **Dérive migrations.** Le schéma reminders existait en live sans migration
   versionnée (018 non enregistrée) ; les 3 migrations de la branche
   stabilize n'étaient pas appliquées en live.
6. **Test unitaire périmé** sur `normalizeTenantPhone` (le code normalise
   désormais en E.164 `+229…`, conforme ADR-003).
7. Lint : 5 apostrophes non échappées dans le JSX.

## 3. Corrections apportées

- `supabase/migrations/20260702090000_tenant_confirmation_rpc.sql` : deux
  fonctions `SECURITY DEFINER` clés sur le token UUID
  (`get_rent_due_by_token`, `declare_rent_payment_by_token`). L'anon n'accède
  plus à aucune table ; exposition limitée aux champs affichés. Page et action
  `/confirmer/[token]` réécrites pour utiliser ces RPC.
- `apps/web/src/lib/supabase/admin.ts` : client service-role serveur
  uniquement (`SUPABASE_SECRET_KEY`), utilisé par le cron. Le cron renvoie
  une 500 explicite si la clé manque.
- `apps/web/vercel.json` : cron quotidien 08:00 UTC (09:00 Bénin) sur `/api/cron/reminders`.
- Fenêtres de relance corrigées dans `sms.ts` : J-5→J-2 = `j-5`, J-1/J-0 =
  `j-1`, retard = `j+3`, retard ≥ 10 j = `j+10` (copy « en retard » sans durée).
- Live Supabase resynchronisé : migrations `reminders`, `rent_due_invariants`,
  `receipt_correction_flows`, `sensitive_mutation_audit`,
  `tenant_confirmation_rpc` appliquées et enregistrées.
- Test téléphone locataire mis à jour (E.164), apostrophes JSX corrigées.

## 3 bis. Corrections P0/P1 du 2026-07-03 (PR dédiées)

- Déclaration locataire : crée désormais réception draft + allocation vers
  l'échéance exacte du token (migration `20260703010000`). Plus de
  confirmation sans réduction de dette ni quittance `allocations: []`.
- `confirm_collection` : re-contrôle transactionnel du reste dû au moment
  de confirmer (migration `20260703020000`) — deux brouillons concurrents
  ne peuvent plus dépasser `amount_due`.
- Dashboard : « Encaissé ce mois » = allocations des réceptions confirmées
  reçues dans le mois (plus de somme historique globale).
- Mode local : `RANTI_LOCAL_AUTH=1` et `=true` acceptés, jamais en prod.

## 4. Ce qui reste incomplet (honnête)

- **Canal de relance de fait = WhatsApp (cockpit ranti-ops).** Le cron SMS
  `/api/cron/reminders` est **dormant par défaut** : il ne fait rien tant que
  `REMINDERS_SMS_ENABLED` (`1`/`true`) n'est pas défini. Raison : sans
  coordination avec les envois ops (`reminder_events`), activer le SMS
  provoquait une double relance (SMS + WhatsApp) sur la même échéance, et le
  mode sandbox enregistrait des lignes « envoyée » fantômes. Voir M1 (revue
  2026-07-05).
- **Envoi SMS réel** : quand on voudra le SMS, prérequis = (1) cross-dedup
  cron ↔ `reminder_events`, (2) `AT_API_KEY`/`AT_USERNAME` prod, (3)
  `REMINDERS_SMS_ENABLED=1`. Aujourd'hui non activé.
- **`CRON_SECRET` et `SUPABASE_SECRET_KEY`** à définir dans Vercel avant que
  la relance tourne réellement.
- **Auth Google-only (temporaire, 2026-07-05)** : connexion et inscription
  passent uniquement par Google, quel que soit le pays de l'utilisateur. Les
  parcours téléphone/mot de passe/OTP/récupération sont **gelés** — le code
  reste dans `lib/auth/actions.ts`, `validation.ts` et les composants
  `phone-field`/`password-field`, mais aucune page ne les expose (`/recover`
  et `/signup/verify` redirigent). Le gate pays d'inscription est retiré.
  Dégel = re-brancher les formulaires + réactiver le provider Phone Supabase.
  Note : la contrainte « numéro béninois obligatoire » à l'onboarding est
  levée (ADR-011) — sélecteur d'indicatif Bénin/Sénégal/Côte d'Ivoire, numéro
  validé contre le plan du pays via le registre `countries.ts`. Un pays hors
  registre (ex. Togo) reste bloqué tant que son plan n'y est pas ajouté.
- **Mode local** : `RANTI_LOCAL_AUTH` reste disponible pour développer sans
  OAuth.
- UI modifier/archiver manquante pour certains objets (logique métier prête).
- WhatsApp : canal prévu (colonne `channel`), non implémenté — SMS d'abord.
- Deux warnings advisor Supabase sur les RPC token : **intentionnel**
  (page locataire publique, token UUID non devinable). Warning « leaked
  password protection » : à activer dans le dashboard Auth.

## 5. Lancer le projet en local

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
```

`.env.local` requis :

```txt
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
RANTI_LOCAL_AUTH=1              # bypass auth SMS en dev
RANTI_LOCAL_AUTH_USER_ID=…      # id auth.users du landlord seed
RANTI_LOCAL_AUTH_PHONE=…
# Pour tester le cron localement :
CRON_SECRET=dev-secret
SUPABASE_SECRET_KEY=…           # jamais côté client
```

## 6. Migrations Supabase

```bash
supabase login
supabase link --project-ref pcxkxeesgusorrpmrkaj
supabase db reset   # rejoue toutes les migrations + seed.sql
```

Le projet live (`pcxkxeesgusorrpmrkaj`) est à jour jusqu'à
`landlords_rls_initplan` (vérifié le 2026-07-03).

Règle : toute migration appliquée en live — y compris depuis ranti-ops —
doit avoir son fichier versionné ici, avec le même timestamp que la version
live. Les migrations ops (`create_ops_reminders`, `ops_dashboard_views`)
sont rapatriées ; leurs objets sont réservés service_role (aucun grant
anon/authenticated).

## 7. Tester le flux principal

```bash
cd apps/web
npm run test:unit    # 86 tests
npm run lint
npm run build
npm run test:e2e     # Playwright (nécessite RANTI_LOCAL_AUTH)
```

Test manuel de la relance :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
# → {"ok":true,"sent":N} ; les SMS sandbox apparaissent dans les logs serveur
```

Confirmation locataire : récupérer `confirmation_token` d'une échéance et
ouvrir `/confirmer/<token>`.

## 8. Script de démo (appel propriétaire)

Préparation : se connecter au dashboard avec le compte seed (ou son compte),
avoir au moins un bail actif avec une échéance impayée.

1. **Ouvrir le tableau de bord.** « Voici Ranti : votre registre de loyer.
   En un coup d'œil : en retard (rouge), attendu (orange), payé (vert). »
2. **Montrer « À encaisser ».** Chaque ligne = locataire, logement, reste dû,
   date. « Vous savez immédiatement qui doit quoi. »
3. **Cliquer Encaisser.** Enregistrer le paiement (montant alloué à
   l'échéance). Statut passe à payé.
4. **Générer/ouvrir la quittance.** Montrer le PDF : numéro unique, périodes
   réglées. « La preuve, propre, sans papier perdu. »
5. **La relance.** Montrer un SMS type : « Ranti — Votre loyer de 80 000 FCFA
   arrive à échéance le 5 juillet. Confirmez : lien ». « Vous configurez le
   bail une fois ; Ranti relance automatiquement à J-5, J-1, puis en retard. »
6. **La confirmation locataire.** Ouvrir `/confirmer/<token>` sur le
   téléphone : le locataire déclare « J'ai payé », vous validez ensuite.
7. Conclure : « Qui a payé, qui doit, la preuve — c'est tout Ranti. »

Plan B si réseau instable : captures d'écran du parcours prises à l'avance.

## 9. Risques connus

- Relance réelle non testée avec un vrai provider SMS (sandbox seulement).
- `generate_rent_dues` génère jusqu'au mois courant : une démo un 1er du mois
  montre peu d'échéances — préparer les données la veille.
- Mode local auth (`RANTI_LOCAL_AUTH`) ne doit jamais être activé en prod.

## 10. Prochaines actions recommandées

1. Configurer `CRON_SECRET` + `SUPABASE_SECRET_KEY` dans Vercel et vérifier
   une exécution réelle du cron (logs Vercel).
2. Canal de relance : WhatsApp (ranti-ops) fait foi. Le SMS reste dormant
   (`REMINDERS_SMS_ENABLED` off). Avant d'activer un provider SMS : coder le
   cross-dedup cron ↔ `reminder_events` pour ne pas doubler WhatsApp.
3. Merger `stabilize/p0-invariants` dans `main` (le live est déjà aligné).
4. Écran « Relances » côté propriétaire : historique des SMS envoyés
   (table `reminders`, déjà en place) + validation des déclarations locataires
   (réceptions `draft`).
5. UI modifier/archiver (logements, propriétés, locataires) — logique déjà
   prête côté serveur.
