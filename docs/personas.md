# Ranti — Personas

## Statut

Version 0.3 (2026-08-09, ADR-029). Le persona primaire passe du bailleur
particulier à l'entreprise de gestion immobilière.

Ce document distingue ce qui est confirmé, ce qui est une hypothèse, et ce qui
doit être validé sur le terrain.

## Persona primaire — L'entreprise de gestion immobilière

### Statut

Hypothèse prioritaire à valider terrain (ADR-029). Le segment précédent, le
bailleur particulier, a été mis en ligne le 20 juillet 2026 et n'a produit
aucune adoption.

### Profil

Agence immobilière, administrateur de biens ou gestionnaire indépendant, au
Bénin puis en zone UEMOA. Il administre des dizaines de lots pour le compte de
plusieurs propriétaires mandants, sous mandat de gestion.

Il travaille aujourd'hui sur Excel, WhatsApp et un carnet. Il a un compte
marchand, une banque et un comptable.

### Problème principal

La clôture du mois. Pour chaque mandant, établir ce qui a été encaissé sur ses
lots, ce qui a été retenu en honoraires, ce qui lui est reversé, et le
justifier par un document que le mandant peut recompter.

Cette opération occupe trois à cinq jours par mois.

### Autres besoins

1. Faire entrer un portefeuille existant sans le ressaisir lot par lot.
2. Savoir, à tout moment, qui est en retard sur l'ensemble du portefeuille.
3. Relancer tous ses retards en une passe, pas lot par lot.
4. Produire des quittances numérotées et vérifiables.
5. Retrouver l'historique d'un lot quand un mandant conteste.

### Comportements actuels probables

- Il tient un classeur Excel par immeuble ou par propriétaire.
- Il relance au téléphone et sur WhatsApp, quand il y pense.
- Il recopie ses chiffres en fin de mois pour produire un décompte par
  propriétaire.
- Il perd du temps à retrouver quel versement couvrait quel mois.

### Ce qui le fait changer d'outil

- Il remplace un travail existant, pas un outil existant.
- Le gain se mesure en jours de fin de mois.
- Le relevé qu'il remet à ses mandants engage sa réputation professionnelle.

### Risques

- L'entrée dans le produit se fait par la reprise du portefeuille : un import
  qui échoue coûte le prospect.
- Il peut avoir plusieurs employés sur le même portefeuille, ce que le produit
  ne gère pas encore (ADR-029, remis à plus tard).
- Il peut demander une comptabilité complète, un rapprochement bancaire, un
  encaissement intégré. Ces demandes sortent du périmètre.
- Il peut refuser un outil qui prétend entrer dans son flux d'argent.

### Critère de réussite

Sa clôture mensuelle passe intégralement par Ranti, deux mois de suite, et il
remet à ses mandants un relevé produit par le produit.

## Persona secondaire — Le propriétaire mandant

### Statut

Hypothèse. Le mandant n'est pas un utilisateur du produit (ADR-029).

### Profil

Personne physique ou société qui possède un ou plusieurs biens et en confie la
gestion à une agence. Il ne se connecte pas, ne crée pas de compte, ne consulte
aucun écran.

### Problème principal

Il ne sait pas ce qui a été encaissé sur ses biens, ni comment se calcule ce
qu'on lui reverse. Il reçoit un chiffre, rarement un décompte.

### Besoins

- Recevoir un relevé mensuel lisible, lot par lot.
- Comprendre le calcul des honoraires.
- Voir ce qui reste dû sur ses lots.

### Rôle produit

Il reçoit un document. Ce document porte la marque et circule dans un milieu où
chaque destinataire est lui-même client potentiel d'une agence.

### Critère de réussite

Il recompte le relevé à la main et tombe sur le même chiffre.

## Persona tertiaire — Le locataire

### Statut

Hypothèse secondaire, inchangée.

### Profil

Il paie son loyer en espèces, Mobile Money, virement ou autre moyen local. Il
n'a pas de compte Ranti. Il reçoit une relance, une quittance, et peut certifier
ou contester cette quittance par un lien à jeton (ADR-013).

### Besoins

- Prouver qu'il a payé.
- Recevoir un document clair.
- Recevoir des messages compréhensibles et respectueux.

### Critère de réussite

Il obtient une quittance sans friction supplémentaire et peut la faire vérifier.

## Persona observé — Le bailleur particulier

### Statut

Servi, non ciblé (ADR-029).

### Profil

Propriétaire de 1 à 20 logements qui gère lui-même, sans mandant. Le produit
fonctionne pour lui : ses biens ont simplement `owner_id` à `NULL`.

### Pourquoi il ne pilote plus le produit

Fréquence d'usage faible, pas de ligne budgétaire de gestion, acquisition un par
un. Mesuré : adoption nulle après la mise en ligne du 20 juillet 2026.

## Non-personas

Ranti ne cible pas :

- les promoteurs immobiliers ;
- les plateformes d'annonces et marketplaces ;
- les banques et établissements de paiement ;
- les sociétés de recouvrement ;
- les cabinets comptables ;
- les propriétaires qui veulent uniquement vendre ou publier des annonces.

## Décision

Le produit est conçu pour l'entreprise de gestion immobilière qui administre des
lots sous mandat. Le mandant est un destinataire de document, pas un
utilisateur. Le locataire est important, il n'est pas le centre du produit.

## Questions terrain à valider

1. Combien de lots l'agence gère-t-elle, pour combien de mandants ?
2. Sous quelle forme le portefeuille existe-t-il aujourd'hui (Excel, papier,
   logiciel) ?
3. Combien de temps prend la clôture mensuelle, et qui la fait ?
4. Quelle forme prend le relevé remis au mandant aujourd'hui ?
5. Comment sont calculés les honoraires : taux unique, taux par mandant, taux
   par lot, forfait ?
6. Que se passe-t-il quand un mandant conteste un chiffre ?
7. Combien de personnes travaillent sur le même portefeuille, et se
   partagent-elles un identifiant ?
8. Comment relance-t-elle aujourd'hui, et à quel rythme ?
9. Que fait-elle des quittances : les édite-t-elle, les réclame-t-on ?
10. Combien paie-t-elle aujourd'hui pour ses outils, et sur quelle ligne ?
11. Qu'est-ce qui la ferait renoncer à Ranti après un mois d'essai ?
12. Accepterait-elle de saisir ou de confirmer chaque encaissement ?
