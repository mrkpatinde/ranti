# Ranti — Glossaire

## Statut

Version 0.2 — document de travail.

Ce glossaire définit les mots importants du domaine Ranti afin que le produit, le design, le code et la documentation utilisent le même langage.

## Propriétaire

Personne qui possède ou gère une ou plusieurs propriétés et qui suit les relations locatives.

Le propriétaire est le client commercial principal de Ranti.

## Propriété

Lieu physique appartenant au propriétaire.

Une propriété peut contenir un ou plusieurs logements.

Exemples : maison à Agla, immeuble à Calavi, villa à Porto-Novo.

## Logement

Espace louable situé dans une propriété.

Un logement peut être une maison entière, un appartement, une chambre, une boutique, un magasin, un bureau ou un entrepôt.

Le logement est ce qui est effectivement loué au locataire.

## Locataire

Personne qui occupe ou exploite un logement dans le cadre d'un bail ou accord locatif.

Dans le MVP, un locataire ne pilote pas le produit. Il peut cependant transmettre une preuve de paiement ou recevoir une quittance.

## Bail

Accord locatif entre un propriétaire et un locataire pour un logement donné.

Le bail définit les règles de la relation locative : montant, périodicité, date d'échéance, date de début et éventuellement date de fin.

Le bail génère les échéances.

## Contrat

Document qui matérialise un bail.

Il peut être papier, photo, scan ou PDF.

Le contrat est une preuve documentaire. Il ne génère pas les échéances.

## Relation locative

Relation entre un propriétaire et un locataire autour d'un logement donné.

Elle est matérialisée par un bail ou accord locatif.

Ranti protège cette relation en rendant les obligations, encaissements, preuves et quittances lisibles.

## Échéance de loyer

Obligation de paiement attendue pour une période donnée.

Une échéance naît automatiquement à partir du bail.

Exemple : le loyer de juillet 2026 attendu avant le 5 juillet 2026.

## Encaissement

Événement financier enregistré du point de vue du propriétaire lorsqu'il reçoit tout ou partie d'un loyer.

Un encaissement peut régler une ou plusieurs échéances.

Une échéance peut recevoir plusieurs encaissements.

Dans l'interface propriétaire, Ranti privilégie le terme "encaissement" plutôt que "paiement", car le propriétaire pense d'abord à ce qu'il a encaissé.

## Paiement

Terme secondaire décrivant l'action du locataire qui paie.

Dans le domaine Ranti côté propriétaire, le concept principal est l'encaissement.

## Alias PI-SPI

Identifiant de paiement du propriétaire dans le système de paiement instantané interopérable de la BCEAO (PI-SPI). Il peut être un numéro de téléphone ou une adresse de paiement générée par PI-SPI.

Le propriétaire renseigne son alias ; Ranti l'affiche au locataire pour qu'il paie le loyer directement, instantanément et gratuitement, depuis n'importe quelle banque ou wallet connecté à PI-SPI.

Sur ce chemin, le paiement reste hors Ranti (de compte à compte), puis est déclaré et encaissé comme tout autre paiement. L'alias n'est pas un canal d'agrégation ; c'est une coordonnée affichée.

Depuis ADR-019, l'alias est le **filet de repli** : le chemin d'encaissement cible est le **rail FeexPay** (cash-in unique ; le propriétaire reçoit alors 95 % du net, Ranti entre dans le flux d'argent), dont l'activation est gatée BCEAO. La promesse « Ranti ne détient jamais les fonds » n'est donc plus la cible produit — elle ne vaut que pour le filet alias.

## Preuve de paiement

Élément permettant de justifier qu'un paiement ou encaissement a été effectué.

Exemples : capture Mobile Money, reçu bancaire, photo d'un reçu papier.

## Quittance ou reçu

Document généré après validation d'un encaissement par le propriétaire.

La quittance confirme qu'une ou plusieurs échéances sont réglées.

## Relance

Action visant à rappeler au locataire qu'une échéance reste impayée ou en retard.
