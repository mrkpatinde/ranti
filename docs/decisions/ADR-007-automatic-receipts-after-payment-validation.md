# ADR-007 — Reçus et quittances automatiques après validation du paiement

## Statut

Accepté.

## Contexte

Un des problèmes centraux de Ranti est la preuve. Le propriétaire ne doit pas devoir fabriquer manuellement un reçu après chaque validation de paiement.

Cependant, Ranti ne doit pas confirmer un paiement sans validation humaine au MVP. Une capture ou une déclaration locataire ne suffit pas à prouver la réception effective.

## Décision

Après validation d'une réception de paiement par le propriétaire, Ranti génère automatiquement le document adapté.

Paiement partiel validé : Ranti génère un reçu de paiement partiel.

Échéance totalement soldée : Ranti génère une quittance ou un reçu complet pour la période.

## Règles métier

- Le propriétaire valide la réception du paiement.
- Ranti met à jour l'échéance.
- Ranti calcule le solde restant.
- Ranti génère automatiquement le document adapté.
- Un document émis conserve un snapshot.
- Un document émis ne se modifie jamais silencieusement.
- Toute correction passe par annulation ou remplacement tracé.
- Le numéro du document est généré automatiquement par Ranti.

## Conséquences produit

- L'action principale n'est pas "créer un reçu" mais "valider le paiement".
- L'écran de validation doit annoncer le document qui sera généré.
- Le propriétaire peut consulter, télécharger ou partager le document après génération.
- Les documents deviennent une conséquence naturelle du cycle de loyer.

## Conséquences techniques

- La génération doit être transactionnelle ou cohérente avec la confirmation du paiement.
- Les documents doivent conserver un snapshot des données importantes.
- La numérotation doit être unique par propriétaire.
- Les corrections doivent respecter les flux d'annulation/remplacement.
- Les actions doivent être auditées.

## Non-objectifs

- Pas de modification silencieuse d'un reçu ou d'une quittance.
- Pas de document sans paiement validé.
- Pas de lien public non contrôlé vers une preuve sensible.
