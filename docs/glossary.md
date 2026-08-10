# Ranti — Glossaire

## Statut

Version 0.3 (2026-08-09) — document de travail. Vocabulaire du pivot ADR-029
(mandant, clôture, honoraires de gestion, relevé propriétaire) et retrait du
vocabulaire du rail de paiement (ADR-030).

Ce glossaire définit les mots importants du domaine Ranti afin que le produit, le design, le code et la documentation utilisent le même langage.

## Entreprise de gestion

Agence immobilière, administrateur de biens ou gestionnaire indépendant qui
administre des biens pour le compte de tiers, sous mandat.

L'entreprise de gestion est le client commercial de Ranti (ADR-029). C'est elle
qui détient le compte.

Dans le code et la base, le compte reste porté par la table `landlords` et la
colonne `landlord_id`. Ce nom est conservé pour ne pas réécrire les 35 policies
RLS et le helper `private.current_landlord_id()`.

## Mandant

Propriétaire pour le compte duquel l'entreprise de gestion administre un ou
plusieurs biens, en vertu d'un mandat de gestion.

Le mandant n'est pas un utilisateur : il ne crée pas de compte, ne se connecte
pas, ne consulte aucun écran. Il reçoit chaque mois un relevé propriétaire.

Table `public.owners`. Un bien lui est rattaché par `properties.owner_id` ;
`NULL` désigne un bien détenu en propre par le titulaire du compte.

## Honoraires de gestion

Part du loyer **encaissé** que l'entreprise de gestion conserve en rémunération
de son mandat.

Exprimés en points de base attachés au mandant (`owners.fee_rate_bp` ; 800 =
8 %). Calculés lot par lot, à l'arrondi inférieur :
`honoraires = floor(encaissé × taux / 10000)`. Le total d'un relevé est la somme
des lignes.

Les honoraires ne se calculent jamais sur le loyer attendu. Un mois sans
encaissement produit zéro honoraire.

## Clôture

Opération mensuelle par laquelle l'entreprise de gestion arrête, pour chaque
mandant, ce qui a été encaissé sur ses lots, ce qui a été retenu en honoraires
et ce qui lui reste dû.

C'est le moment de vérité du produit (ADR-029). Écran `/cloture`, vue
`owner_month_summary`.

## Relevé propriétaire

Document remis au mandant à l'issue de la clôture : une ligne par lot (attendu,
encaissé, honoraires, net), les totaux du mois, et l'identité de l'agence
émettrice.

Il doit s'additionner à la main : un mandant qui recompte tombe sur le même
chiffre. RPC `owner_statement` et `owner_statement_lines`.

## Propriétaire

Terme ambigu depuis ADR-029, à éviter seul. Selon le contexte, il désigne le
titulaire du compte (l'entreprise de gestion) ou le mandant. Employer
« gestionnaire » ou « agence » d'un côté, « mandant » de l'autre.

## Propriété

Lieu physique administré par le compte, pour son propre compte ou pour celui d'un mandant.

Une propriété peut contenir un ou plusieurs logements.

Exemples : maison à Agla, immeuble à Calavi, villa à Porto-Novo.

## Lot (logement)

Espace louable situé dans une propriété.

Un lot peut être une maison entière, un appartement, une chambre, une boutique, un magasin, un bureau ou un entrepôt.

Le lot est ce qui est effectivement loué au locataire. « Lot » est le terme du
métier de la gestion ; « logement » reste employé dans les surfaces destinées à
un bailleur qui gère lui-même. Table `public.units`.

## Locataire

Personne qui occupe ou exploite un logement dans le cadre d'un bail ou accord locatif.

Dans le MVP, un locataire ne pilote pas le produit. Il peut cependant transmettre une preuve de paiement ou recevoir une quittance.

## Bail

Accord locatif entre un propriétaire et un locataire pour un lot donné. Quand le bien est géré sous mandat, l'agence agit au nom du propriétaire, sans être partie au bail.

Le bail définit les règles de la relation locative : montant, périodicité, date d'échéance, date de début et éventuellement date de fin.

Le bail génère les échéances.

## Contrat

Document qui matérialise un bail.

Il peut être papier, photo, scan ou PDF.

Le contrat est une preuve documentaire. Il ne génère pas les échéances.

## Relation locative

Relation entre un propriétaire et un locataire autour d'un lot donné, administrée le cas échéant par une entreprise de gestion.

Elle est matérialisée par un bail ou accord locatif.

Ranti protège cette relation en rendant les obligations, encaissements, preuves et quittances lisibles.

## Échéance de loyer

Obligation de paiement attendue pour une période donnée.

Une échéance naît automatiquement à partir du bail.

Exemple : le loyer de juillet 2026 attendu avant le 5 juillet 2026.

## Encaissement

Événement financier enregistré du point de vue du gestionnaire lorsqu'il reçoit tout ou partie d'un loyer.

Un encaissement peut régler une ou plusieurs échéances.

Une échéance peut recevoir plusieurs encaissements.

Dans l'interface du gestionnaire, Ranti privilégie le terme "encaissement" plutôt que "paiement" : le gestionnaire pense d'abord à ce qu'il a encaissé. C'est aussi la base de calcul des honoraires.

## Paiement

Terme secondaire décrivant l'action du locataire qui paie.

Dans le domaine Ranti côté gestionnaire, le concept principal est l'encaissement.

## Alias de paiement (PI-SPI)

Coordonnée de paiement de l'entreprise de gestion : numéro marchand Mobile
Money, ou alias dans le système de paiement instantané interopérable de la BCEAO
(PI-SPI, numéro de téléphone ou adresse de paiement).

L'agence renseigne son alias (`landlords.payment_alias`) ; Ranti l'affiche au
locataire pour qu'il paie directement, depuis n'importe quelle banque ou wallet
connecté.

Le paiement reste hors Ranti, de compte à compte, puis est enregistré et validé
comme tout autre encaissement. L'alias est une coordonnée affichée, jamais un
canal d'agrégation.

Depuis ADR-030, l'alias est le seul chemin d'encaissement documenté : le rail
custodial est supprimé et « Ranti ne détient jamais les fonds » redevient la
règle du produit.

## Preuve de paiement

Élément permettant de justifier qu'un paiement ou encaissement a été effectué.

Exemples : capture Mobile Money, reçu bancaire, photo d'un reçu papier.

## Quittance ou reçu

Document généré après validation d'un encaissement par le gestionnaire.

La quittance confirme qu'une ou plusieurs échéances sont réglées.

## Relance

Action visant à rappeler au locataire qu'une échéance reste impayée ou en retard.

Ranti prépare le message et conserve la trace ; l'envoi part du WhatsApp du
gestionnaire par lien `wa.me` (ADR-022).

## Relance par lot

Passe unique sur toutes les échéances à relancer d'un portefeuille : la file se
lit dans la vue `reminder_batch`, l'enregistrement de la trace se fait en un
appel (`log_reminder_batch`). Écran `/reminders/batch`.

## Import de portefeuille

Entrée d'une agence dans le produit par fichier : mandants, biens, lots,
locataires et baux en une opération. Deux temps, une validation ligne par ligne
sans écriture, puis un import tout-ou-rien idempotent. Écran `/import`.

## Grand livre (compte courant locatif)

Registre unique des sommes dues et reçues sur un bail (ADR-023). Chaque
mouvement est une **transaction** : loyer, réparation, frais (débits),
règlement (crédit), contre-passation (correction). Le grand livre est
append-only : rien ne s'y efface, tout s'y corrige par une nouvelle ligne.

## Transaction (ligne du grand livre)

Somme due ou reçue sur un bail, avec un statut de reconnaissance : `pending`
(affirmée par une partie), `validated` (certaine — indélébile), `disputed`
(contestée, désaccord documenté), `withdrawn` (retirée par son auteur avant
validation).

## Contre-passation

Ligne inverse qui corrige une transaction validée (montant identique ou
partiel, sens opposé, lien `reversal_of`). L'erreur et sa correction restent
toutes deux lisibles — on ne supprime pas l'histoire (ADR-005, ADR-023).

## Solde certain

Somme des crédits validés moins les débits validés d'un bail : ce que les
deux parties reconnaissent. Les montants « en
attente » (pending) et « en litige » (disputed) sont affichés à part, jamais
fusionnés dans le solde certain.

## Retrait

Sortie d'une ligne jamais validée : son auteur la retire (`withdrawn`), avec
motif, sans contre-passation — une affirmation jamais reconnue n'a pas besoin
d'être annulée comptablement. La ligne reste lisible dans l'historique.
