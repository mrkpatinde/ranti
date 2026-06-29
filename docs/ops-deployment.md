# Ranti — Ops et Déploiement

## Statut

Version 0.1 — squelette opérationnel à compléter après audit du code et des environnements.

Ce document évite que la configuration de Ranti reste uniquement dans la mémoire des intervenants.

## Objectif

Documenter comment Ranti est configuré, déployé, migré et vérifié.

Ce document ne doit jamais contenir de secrets.

## Environnements

### Local

À documenter :

- prérequis Node ;
- gestionnaire de paquets ;
- commandes d'installation ;
- commandes de dev ;
- connexion Supabase locale ou distante ;
- données de seed ;
- tests à lancer.

### Preview / Vercel

À documenter :

- projet Vercel ;
- root directory ;
- build command ;
- install command ;
- output directory ;
- variables requises ;
- domaines ;
- règle de protection preview si applicable.

### Production

À documenter :

- projet Vercel production ;
- projet Supabase production ;
- stratégie migration ;
- stratégie rollback ;
- monitoring minimum.

## Services externes

### Supabase

Projet live connu : `pcxkxeesgusorrpmrkaj`.

À documenter :

- région ;
- version Postgres ;
- auth providers activés ;
- politiques RLS critiques ;
- buckets Storage ;
- fonctions SQL importantes ;
- migrations appliquées ;
- procédure de migration.

### Vercel

À documenter :

- nom du projet ;
- root directory ;
- branches de déploiement ;
- variables ;
- domaines ;
- logs à vérifier après déploiement.

### Brevo / SMS / Email

À documenter si utilisé :

- rôle exact du service ;
- variables requises ;
- templates ;
- limites ;
- fallback ;
- coût ou quota.

### WhatsApp / SMS futurs

À documenter avant envoi automatique :

- provider ;
- opt-in ;
- templates ;
- coûts ;
- statuts de livraison ;
- retries ;
- désactivation par bail ou locataire.

## Variables d'environnement

Ne jamais écrire les valeurs réelles.

Format attendu :

```txt
VARIABLE_NAME=
Usage :
Scope : local / preview / production
Obligatoire : oui / non
Risque si absent :
```

Variables candidates à vérifier dans le code :

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
BREVO_API_KEY
```

Cette liste doit être confirmée par audit du repo.

## Migrations Supabase

### Règle

Aucune migration ne doit être appliquée sans :

- lecture du schéma live ;
- vérification des migrations déjà appliquées ;
- test fresh-apply ;
- test de régression SQL ;
- plan rollback ou correction ;
- validation explicite si la migration touche paiements, reçus, quittances, relances ou RLS.

### Procédure à documenter

```txt
1. Vérifier l'état live.
2. Créer une migration additive si possible.
3. Lancer fresh-apply local.
4. Lancer tests SQL.
5. Lancer tests applicatifs.
6. Relire diff migration.
7. Appliquer sur l'environnement cible.
8. Vérifier tables, contraintes, politiques RLS et logs.
```

## Tests avant déploiement

À documenter précisément après audit :

```txt
npm test
npm run test
npm run lint
npm run typecheck
npx playwright test
supabase db reset
```

Ne garder que les commandes réellement valides dans le repo.

## Checklist pré-déploiement

- [ ] Les migrations sont testées fresh-apply.
- [ ] Les tests SQL critiques passent.
- [ ] Les tests frontend critiques passent.
- [ ] Les variables d'environnement sont présentes.
- [ ] Les politiques RLS sont cohérentes.
- [ ] Les flux auth sont testés.
- [ ] Les flux de loyer/reçu/quittance sont testés.
- [ ] Aucun secret n'est dans le repo.

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

À compléter.

## Décisions ops à prendre

- Source exacte des variables d'environnement.
- Procédure de migration production.
- Provider SMS/Email/WhatsApp retenu.
- Monitoring minimum.
- Politique de backup.
- Politique de rollback.
