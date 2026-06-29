# Ranti — Ops et Déploiement

## Statut

Version 0.2 — runbook opérationnel minimal.

Ce document doit permettre à quelqu'un d'intervenir sans dépendre uniquement de la mémoire d'Adonis ou d'un agent IA.

Ne jamais y mettre de secret.

## Stack connue

- Monorepo : `apps/web`, `supabase/migrations`, `docs`.
- App web : Next.js dans `apps/web`.
- Déploiement app : Vercel.
- Base : Supabase Postgres.
- Auth : Supabase Auth.
- Projet Supabase live connu : `pcxkxeesgusorrpmrkaj`.
- RLS : activé sur les tables métier.

## Commandes

Depuis la racine :

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test:e2e
```

Depuis `apps/web` :

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:unit
npm run test:e2e
npm run test:watch
```

## Installation locale

```bash
npm install
npm --prefix apps/web install
npm run dev
```

## Build local

```bash
npm run build
```

Si le build échoue, ne pas déployer.

## Tests avant déploiement

```bash
npm run lint
npm --prefix apps/web run test:unit
npm --prefix apps/web run test
npm run test:e2e
```

## Vercel

Configuration connue :

- Root Directory : `apps/web`.
- Build Next.js exécuté dans `apps/web`.
- Éviter une configuration racine qui contredit le monorepo.

À vérifier avant déploiement :

- Root Directory = `apps/web`.
- Config d'environnement présente côté Vercel.
- Branche de production correcte.
- Domaine correct.
- Logs de build sans erreur.

## Supabase

Projet live connu : `pcxkxeesgusorrpmrkaj`.

Tables live observées :

```txt
landlords
properties
units
tenants
leases
rent_dues
rent_receptions
rent_reception_allocations
payment_proofs
receipts
audit_logs
reminders
```

Attention : `lease_reminder_rules` n'existe pas encore en DB live au moment de la gap analysis.

## Déploiement standard

1. Vérifier l'état Git.
2. Lancer les tests pertinents.
3. Lancer le build local.
4. Vérifier les migrations en attente.
5. Déployer via Vercel.
6. Lire les logs de build.
7. Tester le login.
8. Tester le dashboard.
9. Tester un flux propriétaire minimal si l'environnement le permet.

## Migration Supabase — règle stricte

Aucune migration ne doit être appliquée sans :

- lecture du schéma live ;
- vérification des migrations déjà présentes ;
- test fresh-apply ;
- test de régression SQL ;
- plan rollback ou correction ;
- validation explicite si la migration touche paiements, reçus, quittances, relances ou RLS.

## Migration Supabase — procédure

```txt
1. Lire le schéma live.
2. Comparer avec docs/database.md et migrations existantes.
3. Créer une migration additive si possible.
4. Lancer fresh-apply local ou sur branche de dev.
5. Lancer les tests SQL critiques.
6. Lancer les tests applicatifs.
7. Relire les contraintes, index et RLS.
8. Appliquer sur l'environnement cible.
9. Vérifier tables, contraintes, policies, logs et flux UI.
```

## Checklist pré-déploiement

- [ ] Le build passe.
- [ ] Le lint passe ou les exceptions sont documentées.
- [ ] Les tests unitaires critiques passent.
- [ ] Les tests E2E critiques passent si le changement touche l'UI.
- [ ] Les migrations fresh-apply passent si le changement touche la DB.
- [ ] Les politiques RLS sont cohérentes.
- [ ] Aucun secret n'est dans le repo.
- [ ] La config d'environnement est présente dans Vercel.

## Checklist post-déploiement

- [ ] Le login fonctionne.
- [ ] Le dashboard charge.
- [ ] La création propriété/logement/locataire fonctionne.
- [ ] La création/activation de bail fonctionne.
- [ ] Les échéances sont visibles.
- [ ] L'encaissement fonctionne.
- [ ] Les reçus/quittances s'affichent.
- [ ] Les logs Vercel ne montrent pas d'erreur bloquante.
- [ ] Supabase ne montre pas d'erreur RLS inattendue.

## Incidents connus

### Provider téléphone Supabase Auth

Symptôme : login ou inscription téléphone bloqué.

Cause probable : provider téléphone non activé ou mal configuré.

Action : vérifier la configuration Auth dans Supabase Dashboard.

### RLS sans policy

Symptôme : l'app ne peut pas lire/écrire via utilisateur authentifié alors que les tables existent.

Cause probable : RLS activé sans policies correspondantes.

Action : vérifier les policies appliquées et les migrations RLS.

### Mauvais Root Directory Vercel

Symptôme : build Vercel échoue ou ne trouve pas l'app.

Cause probable : Root Directory différent de `apps/web`.

Action : corriger la configuration Vercel.

## Services externes à documenter avant usage complet

- Email transactionnel.
- SMS.
- WhatsApp.
- Génération PDF.
- Stockage fichiers.

Pour chaque service, documenter : rôle exact, provider, environnement, limites, erreurs connues, fallback et coût.

## Décisions ops ouvertes

- Source exacte de la configuration d'environnement.
- Procédure de migration production.
- Provider SMS/Email/WhatsApp retenu.
- Monitoring minimum.
- Politique de backup.
- Politique de rollback.
