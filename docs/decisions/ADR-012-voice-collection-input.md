# ADR-012 — Saisie vocale des encaissements (effet Granola)

## Statut

Accepté (V1 — encaissement uniquement). **Superseded par ADR-019 (2026-07-15)** :
la saisie vocale est retirée du code ; le rail FeexPay devient le chemin
d'encaissement unique.

## Contexte

La promesse produit de Ranti est une saisie « à la voix », sans formulaire. Le
produit livré est aujourd'hui formulaire d'abord : après connexion, le
propriétaire tape ses encaissements dans `/collections/new`. La saisie vocale
n'existe pas encore dans le code.

Les propriétaires béninois travaillent sur le terrain (moto-taxi, marché,
bruit), avec un forfait data limité. Une écoute ambiante continue (style
Granola en réunion) est exclue : batterie et data. Le geste doit être
volontaire et court.

Ce qu'on emprunte à Granola : **low input, high output**. Le propriétaire dit
« Koffi a payé juillet », et l'IA complète toute la fiche grâce au contexte du
bail (locataire actif, logement, loyer, échéances). L'IA ne remplace pas le
registre : elle pré-remplit, l'humain valide.

## Décision

Ajouter une couche d'entrée vocale **par-dessus** le chemin d'écriture existant,
sans le contourner.

1. Bouton micro « push-to-talk » sur le tableau de bord. Enregistrement
   volontaire et court (`MediaRecorder`).
2. L'audio est envoyé à `POST /api/voice/collection`. Le serveur appelle
   Gemini 2.5 Flash (Structured Outputs) **en lui fournissant le portefeuille
   du propriétaire** (baux actifs : locataire, logement, loyer). Gemini
   transcrit et résout la phrase vers un `lease_id` du portefeuille, plus un
   montant et une période.
3. Le serveur **valide** que le `lease_id` renvoyé appartient bien au
   propriétaire connecté (jamais de confiance aveugle dans la sortie du
   modèle).
4. Le client affiche une **carte de validation** (fiche d'action). Aucune
   écriture en base à ce stade.
5. La validation renvoie vers le formulaire existant
   `/collections/new?lease_id=…`, qui reste l'unique point d'écriture
   (`record_collection` → `confirm_collection` → `generate_receipt`).

## Règles

- **Confirmation humaine avant écriture.** Une hallucination comptable
  (« 15 000 » entendu au lieu de « 50 000 » sous un coup de klaxon) ne doit
  jamais toucher la base. La carte est relue, la confirmation se fait dans le
  formulaire d'encaissement existant.
- **Le vocal ne crée jamais de quittance directement.** Il pré-remplit un
  encaissement. La quittance reste une conséquence de la confirmation
  (ADR-007). Aucun chemin d'écriture parallèle.
- **Sortie du modèle non fiable par défaut.** Le `lease_id` est re-vérifié
  côté serveur contre les baux du propriétaire. Un `lease_id` inconnu est
  rejeté et la carte bascule en saisie manuelle.
- **Fallback systématique.** Pas de micro (Safari iOS restreint), refus de
  permission, échec Gemini, clé absente : on retombe sur le formulaire manuel
  existant. Le vocal est une accélération, jamais un prérequis.
- **Audio non conservé.** L'enregistrement est transmis, traité, puis jeté.
  Rien n'est stocké côté serveur (bon pour l'APDP).
- **Clé Gemini côté serveur uniquement** (`process.env.GEMINI_API_KEY`),
  jamais exposée au client. La route est le seul appelant.

## Conséquences

- Le tableau de bord gagne un point d'entrée vocal ; les formulaires
  deviennent le filet de sécurité et l'écran de validation.
- Le coût Gemini est par requête volontaire (pas de streaming continu).
- La qualité dépend de la tenue de Gemini sur l'accent béninois et les noms
  locaux. À valider en dogfood terrain avant d'étendre au bail (ADR futur).

## Hors périmètre (V1)

- La saisie vocale d'un **nouveau bail** (caution, avance sur loyer, reçu de
  caution, page publique `/bail/[token]`) fera l'objet d'un ADR dédié et
  suppose des ajouts au modèle de données (colonnes caution/dépôt/avance).
- Le pré-remplissage du montant exact dans le formulaire d'encaissement
  (aujourd'hui le formulaire propose le total dû) est une amélioration V1.1.
