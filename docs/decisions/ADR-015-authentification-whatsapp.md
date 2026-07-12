# ADR-015 — Authentification par WhatsApp (proposition)

## Statut

Proposée — 2026-07-11. En attente d'arbitrage. Ne remplace ni ne dégèle
l'ADR-010 tant qu'elle n'est pas acceptée.

## Contexte

Une page de connexion « Continuer avec WhatsApp » a été proposée : le
propriétaire saisit son numéro, le serveur génère un jeton temporaire, le
client ouvre un lien `wa.me/{numéro-système}?text=Connexion Ranti: {token}`, et
le propriétaire envoie ce message pré-rempli depuis WhatsApp pour prouver son
identité « sans frais ».

Cette proposition entre en conflit direct avec deux décisions déjà en vigueur :

1. **ADR-010 (Google-only, acceptée 2026-07-10)** : inscription et connexion
   passent *uniquement* par Google, tous pays. Les voies téléphone/OTP sont
   gelées, pas supprimées. `welcome-flow.md` : « Aucune saisie de mot de passe
   ni vérification OTP dans la connexion normale ». Ajouter WhatsApp = rouvrir
   une 3ᵉ voie d'auth que l'ADR-010 vient de fermer pour simplifier l'accueil.

2. **Principe « Zéro API WhatsApp » (ADR-014, étape notification)** : le produit
   n'utilise WhatsApp qu'en **sortant** via `wa.me` (lien profond, message
   pré-rempli ouvert dans l'app native du propriétaire), justement pour
   « éliminer tout coût ou risque de bannissement lié aux API de diffusion
   officielles ».

## Problème technique de fond

Un login par WhatsApp exige de **recevoir** un message entrant côté serveur
(le token renvoyé par le propriétaire). Recevoir un message WhatsApp
programmatiquement impose un **webhook WhatsApp Business Cloud API (Meta)** :

- Coût : numéro Business vérifié + conversations facturées ; sort du modèle
  « zéro coût » revendiqué.
- Risque : compte Business soumis aux règles Meta, suspensions possibles — le
  risque de bannissement que le produit fuit explicitement.
- Asymétrie : `wa.me` **sortant** (notif locataire) reste zéro-API et sûr ;
  `wa.me` **entrant comme canal d'auth** ne l'est pas. Les deux ne sont pas
  équivalents.

Boucle de session incomplète dans la proposition : `window.location.href`
quitte le navigateur vers WhatsApp. Rien ne relie la session du navigateur au
message envoyé (pas de polling, pas de retour). Même avec le webhook, il
faudrait un canal de reprise (polling du token, deep-link retour, magic link)
non spécifié — c'est le cœur difficile d'un tel flux, pas un détail.

## Options

### A. Statu quo — Google-only pour l'auth (recommandée)

Garder ADR-010 tel quel. WhatsApp reste **exclusivement sortant** (`wa.me`,
notif locataire depuis le journal, ADR-014 étape 6). Aucun webhook, aucun coût,
aucun risque de ban. Un seul geste d'auth (Google), accueil inchangé.

- **Pour** : conforme docs, zéro dette, zéro coût, boucle d'auth déjà résolue.
- **Contre** : ne couvre pas un propriétaire sans compte Google (cas à mesurer
  terrain avant d'y investir).

### B. Auth WhatsApp via Business Cloud API

Brancher le webhook Meta, corréler le token entrant à la session (polling ou
magic-link retour), gérer numéro Business vérifié + facturation.

- **Pour** : parcours « téléphone-first » aligné sur l'usage local si Google
  est un frein réel.
- **Contre** : casse le principe zéro-API, coût récurrent, risque de ban,
  surface de sécurité nouvelle (rejeu du token, énumération de numéros,
  rate-limiting), conflit frontal ADR-010. Boucle de session à concevoir
  entièrement.

### C. Dégel des voies téléphone/OTP existantes (ADR-010 §4)

Ne pas inventer WhatsApp : réactiver le parcours téléphone + OTP SMS déjà en
code (gelé, pas supprimé) via le mécanisme de dégel prévu, pays par pays.

- **Pour** : réutilise `lib/auth/actions.ts`, `normalizePhone`, `phone-field`,
  provider Phone Supabase ; aucun nouveau canal ; sécurité OTP standard.
- **Contre** : l'ADR-010 note que « l'envoi d'OTP SMS n'est pas opérationnel » —
  à rendre opérationnel d'abord ; coût SMS.

## Décision

À trancher. Recommandation technique : **Option A** — conserver Google-only,
garder WhatsApp en sortant `wa.me` uniquement. Si un besoin terrain d'auth
« téléphone-first » est confirmé, préférer **Option C** (dégel du parcours
existant) à l'Option B (nouveau canal WhatsApp Business API).

## Conséquences

- Si A : la page de login WhatsApp proposée n'est pas intégrée. On enchaîne sur
  la notification WhatsApp sortante depuis le journal (ADR-014 étape 6).
- Si B ou C : cette ADR doit d'abord amender/dégeler l'ADR-010 (statut → dégel
  partiel), spécifier la reprise de session et le rapprochement des comptes
  existants créés par téléphone (déjà signalé comme dette dans l'ADR-010).
