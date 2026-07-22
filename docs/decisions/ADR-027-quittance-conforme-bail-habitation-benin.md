# ADR-027 — Conformité de la quittance au bail d'habitation (Loi n°2022-30, Bénin)

## Statut

Accepté (2026-07-22, décision CEO). **Ce document n'est pas un avis juridique** : le libellé
final de la quittance doit être validé par un professionnel du droit béninois.

## Contexte

Exigence : la quittance de loyer doit respecter la législation applicable. Recherche :

- Ranti cible le **bail à usage d'habitation** (logements). Régime applicable : **Loi n°2022-30 du
  20/12/2022** (Bénin). **Art. 67** : « Le loyer est payable au domicile du bailleur ou de son
  représentant **contre une quittance** » : la quittance est la **preuve légale du paiement mensuel
  du loyer**.
- **L'OHADA (AUDCG art. 101 à 134) ne régit que le bail à usage professionnel/commercial**, pas
  l'habitation : il **ne s'applique pas** à la quittance d'habitation de Ranti.
- Art. 66 : décompte daté et signé des éléments du loyer (avant le 1er terme, révisé annuellement).
  Hors périmètre (Ranti est rent-only, le loyer est l'unique élément).

État initial : la quittance portait déjà le titre « Quittance de loyer », un numéro
(`RNT-AAAA-NNNN`), la date d'émission, le nom du bailleur (+ tél), le nom du locataire, l'adresse du
logement, la période réglée, le montant en chiffres et en lettres, la clause de solde, et
distinguait déjà **quittance (solde total)** de **reçu (paiement partiel)**. Seule l'identité
complète du bailleur manquait (pas d'adresse postale).

## Décision

1. **Régime = habitation (Loi 2022-30).** OHADA hors périmètre. La justification OHADA de la
   migration `20260719130000` (adresse du logement) est corrigée vers le régime d'habitation.

2. **quittance = solde, reçu = partiel** (déjà en place, `generate_receipt_core`,
   `bool_and(status='paid')`) : c'est la règle légale (un paiement partiel donne un reçu, jamais une
   quittance). À préserver.

3. **Identité du bailleur complétée** : ajout de l'**adresse postale** du bailleur
   (`landlords.address` / `city`, nullable, **mutable** comme contact, distincte de l'identité
   verrouillée ADR-002). Lue **en direct** (jointure landlords), comme le nom déjà exposé, donc non
   figée au snapshot ; l'empreinte d'intégrité ne couvre pas le bloc bailleur, ici comme avant.
   Affichée dans le bloc « De » du PDF et sur la surface locataire (`/recu/[token]`).

4. **Posture « preuve » gardée** (ADR-013) : l'empreinte SHA-256 reste une **preuve d'intégrité**,
   jamais une « signature électronique » ; aucune formule « fait foi » / « preuve irréfutable » n'est
   ajoutée. Mentions strictement factuelles.

## Conséquences

- La quittance porte désormais : titre, numéro, date, **bailleur (nom, adresse, tél)**, locataire,
  logement (nom + adresse), montant en chiffres et lettres, période réglée, clause de solde, statut
  d'acquittement, empreinte d'intégrité (si certifiée), QR de vérification.
- Anciennes quittances inchangées (adresse bailleur nulle → ligne omise).
- **Revue juridique** par un professionnel béninois recommandée avant de communiquer sur la
  conformité.
- Ne pas réécrire seul `positioning.md` / CGU / `DESIGN.md` (formules « fait foi », posture marque) :
  décision CEO distincte.

## Suivi

- Optionnel, posture-sensible : mention factuelle discrète en pied (« Quittance de loyer, loi
  n°2022-30 »), à n'ajouter que sur validation (risque de lecture comme claim juridique, ADR-013).
- Décompte du loyer (Art. 66) : à traiter séparément si besoin (document de bail, pas la quittance).

## Sources

- Bénin, Loi n°2022-30 du 20/12/2022 (bail d'habitation), art. 66, 67, 70.
- OHADA, AUDCG (révisé 2010), art. 101 à 134 (bail à usage professionnel, hors habitation).
