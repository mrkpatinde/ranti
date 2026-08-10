# Ranti — Vision Produit

Dernière mise à jour : 2026-08-09 (ADR-029, pivot entreprises de gestion ;
ADR-030, retrait du rail de paiement).

## Positionnement

Ranti est le système opérationnel des entreprises de gestion immobilière au
Bénin, puis en zone UEMOA.

Il tient le registre locatif d'un portefeuille de lots, suit les échéances et
les encaissements, prépare les relances, édite les quittances, et produit la
clôture mensuelle que l'agence doit à chacun de ses propriétaires mandants.

Le compte connecté est l'agence. Le mandant n'a pas de compte : il reçoit un
relevé.

## Problème principal

Une agence de gestion administre des dizaines de lots pour le compte de
plusieurs propriétaires. Elle suit tout cela sur Excel, WhatsApp et un carnet.

Chaque fin de mois, elle doit établir pour chaque mandant ce qui a été encaissé
sur ses lots, ce qui a été retenu en honoraires et ce qui lui est reversé, puis
le justifier. Cette clôture occupe trois à cinq jours par mois. Elle produit
des erreurs, des retards de reversement et des discussions.

## Promesse

Ranti permet à l'agence de répondre rapidement à six questions :

1. Qui a payé ?
2. Qui est en retard, sur l'ensemble du portefeuille ?
3. Quelle relance est prévue ou déjà envoyée ?
4. Quelle quittance a été générée après validation ?
5. Pour chaque mandant, qu'a-t-on encaissé ce mois-ci sur ses lots ?
6. Combien lui doit-on, honoraires déduits ?

## Boucle produit

1. L'agence importe son portefeuille : mandants, biens, lots, locataires, baux.
2. Ranti génère les échéances à partir des baux.
3. L'agence relance ses retards en une passe ; Ranti prépare les messages et
   garde la trace.
4. L'agence enregistre et valide les encaissements reçus.
5. Ranti génère la quittance ou le reçu adapté.
6. En fin de mois, Ranti produit le relevé de chaque mandant : encaissé,
   honoraires, net à reverser.
7. Ranti conserve l'historique des encaissements, relances, documents et
   actions.

## Le wedge : la clôture mensuelle

L'agence sait encaisser. Ce que Ranti prend en charge, c'est la fin du mois.

Règle de calcul unique, appliquée partout dans le produit :

- `encaissé` = allocations sur des encaissements confirmés dont la date de
  réception tombe dans le mois ;
- `honoraires` = `floor(encaissé × taux / 10000)`, calculé lot par lot ;
- `net` = `encaissé − honoraires`.

Les totaux sont la somme des lignes. Un mandant qui recompte à la main tombe sur
le même chiffre. C'est la propriété qui compte sur ce document.

## Trois moteurs produit

### Reminder Engine

Le bail crée les échéances. Les échéances créent les rappels et relances. Sur un
portefeuille de soixante lots, le geste est « je relance tous mes retards », en
une passe. Ranti prépare le message et conserve la trace ; l'envoi part du
WhatsApp du gestionnaire.

### Proof Engine

L'encaissement validé crée la preuve. Ranti génère le document adapté : reçu de
paiement partiel, reçu complet, ou quittance quand l'échéance est soldée. Le
sceau de certification est un HMAC sous secret serveur ; les colonnes de
certification ne s'écrivent que par le parcours locataire à jeton.

### Closing Engine

Le mois crée le relevé. Pour chaque mandant, Ranti compose un document lot par
lot et le total qui en découle.

## Grand livre de confiance (ADR-023)

Toute somme due ou reçue sur un bail est une ligne d'un même grand livre. Une
ligne validée est indélébile ; toute correction est une contre-passation
visible. Ranti reste rent-only : les charges variables sont retirées (ADR-026).

La transition reste inachevée. Le modèle historique (`rent_dues`) et le grand
livre (`transactions`) coexistent depuis la phase « expand » ; la phase
« contract » n'a pas eu lieu. L'égalité entre les deux est contrôlée chaque jour
(`ops_ledger_health`).

## Cible

Entreprises de gestion immobilière : agences, administrateurs de biens,
gestionnaires indépendants. Bénin d'abord, puis zone UEMOA.

Le bailleur particulier qui gère ses propres biens reste servi — ses biens n'ont
pas de mandant — mais il ne dicte plus les arbitrages produit (ADR-029).

## Rapport à l'argent (ADR-030)

Ranti ne détient jamais les fonds. Le loyer circule directement du locataire à
l'agence : espèces, Mobile Money, virement, ou alias de paiement de l'agence
(ADR-009). Aucun compte, aucun wallet et aucun sous-compte au nom de Ranti
n'entre dans la chaîne de paiement.

Le rail de paiement custodial décidé par ADR-018 et ADR-019, gelé par ADR-024,
est supprimé du dépôt et de la base le 2026-08-09.

Conséquences de ce choix :

- Sans détention, Ranti sort du champ de l'Instruction BCEAO n° 001-01-2024 :
  pas d'agrément à chercher, pas de montage d'externalisation à négocier.
- Aucune trésorerie tierce à porter, aucun reversement à exécuter, aucun risque
  de rupture de règlement.
- L'agence garde sa relation bancaire et son compte marchand. Adopter Ranti ne
  lui demande pas de changer sa plomberie financière.

Monétisation : abonnement (ADR-024, disposition 2), gratuit pour le moment
(ADR-028 : aucun prix affiché tant que l'utilité n'est pas démontrée,
engagement de préavis). La commission transactionnelle est abandonnée. Le
sujet PSP se réduit à l'encaissement futur de l'abonnement (recette propre de
Ranti, pas de fonds de tiers) — FedaPay est pressenti, mais le comparatif qui
fonde ce choix n'est PAS consigné dans le dépôt : à reconstituer avant de
s'engager, ou à traiter comme une préférence non documentée.

## Non-objectifs

Ranti n'est pas :

- un CRM immobilier ;
- une marketplace ou un site d'annonces ;
- un logiciel comptable ;
- une banque : pas d'agrément, pas de dépôt, pas de compte Ranti dans le flux,
  pas de crédit ;
- une agence de recouvrement ;
- un portail pour les mandants ou pour les locataires ;
- un produit qui confirme des encaissements sans validation humaine.

## Remis à plus tard (ADR-029)

- Partage d'un compte entre les employés d'une agence, avec rôles.
- Paiement du locataire par PSP au nom de l'agence, sans que Ranti touche les
  fonds.
- Services financiers adossés à l'historique locatif.

## Critère de réussite

Une agence tient sa clôture mensuelle entièrement dans Ranti, deux mois de
suite, et remet à chacun de ses mandants un relevé produit par le produit.

## Règle produit

Aucune fonctionnalité n'entre dans Ranti si elle ne simplifie pas l'une de ces
actions :

- faire entrer ou tenir à jour un portefeuille ;
- savoir qui a payé et qui est en retard ;
- relancer un portefeuille en une passe ;
- valider un encaissement reçu ;
- produire une quittance vérifiable ;
- clôturer le mois et justifier ce qui revient à chaque mandant.
