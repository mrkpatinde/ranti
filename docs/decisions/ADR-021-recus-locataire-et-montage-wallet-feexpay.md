# ADR-021 — Reçus côté locataire (rail vs PSP) et montage wallet FeexPay

## Statut

**Proposée** — analyse consignée le 2026-07-16, **décision CEO + juridique en
attente** sur le montage wallet (voir « Décision requise »). Sans rapport avec
le code déjà livré (rail branché, sandbox) ; conditionne l'écriture de la copie
de la page locataire `/confirmer` et la levée du gate BCEAO (ADR-019).

Précise **ADR-019** (rail FeexPay unique) et **ADR-018** (« Ranti = interface »,
caveat BCEAO). S'appuie sur **ADR-007** (la quittance est la conséquence de la
validation) et **ADR-013** (contestation locataire).

## Contexte

Avec le rail FeexPay, le locataire ne « déclare » plus son paiement
(ADR-009/013) : il **paie dans l'app** et le webhook ingère la transaction. Cela
change ce que le locataire reçoit. Trois messages, de **trois émetteurs**, dont
deux seulement viennent de Ranti :

| # | Message | Émetteur | Nature |
|---|---------|----------|--------|
| 1 | Lien de paiement (dans la relance) | **Ranti** | invitation à payer |
| 2 | Confirmation de débit / reçu de transaction | **FeexPay + MoMo/Moov** | preuve du *mouvement d'argent* |
| 3 | La quittance de loyer | **Ranti** | le *reçu qui fait foi* (ADR-007) |

Le « reçu FeexPay » (#2) n'est **pas une facture** au sens comptable : c'est le
reçu de transaction que tout PSP/Mobile Money envoie au payeur (équivalent du
ticket de TPE ou du SMS de débit). Ranti ne l'émet pas, ne le contrôle pas et ne
peut pas le supprimer.

Deux risques apparaissent :

1. **Confusion de preuve.** Le locataire pourrait croire que le reçu PSP « fait
   foi » pour son loyer. Or seule la **quittance Ranti** certifie le loyer réglé
   (vérifiable sur `/verifier`) ; le reçu PSP ne prouve qu'un mouvement d'argent.
2. **Nom du marchand sur le reçu PSP.** Le reçu #2 affiche le **marchand** = le
   wallet FeexPay. Si ce wallet est **unique au nom de Ranti**, le locataire à
   qui on a dit « payez votre loyer à M. X » voit un débit **« RANTI »** — c'est
   déroutant, et c'est exactement la qualification BCEAO d'« encaissement pour
   compte de tiers » (ADR-018/019).

Point rassurant : le locataire paie **100 % du loyer, zéro surcharge**
(ADR-019). Le **montant** du reçu PSP = le montant de la quittance : **aucun
écart à expliquer** (les 5 % sont prélevés en interne avant reversement,
invisibles du locataire).

## Décision requise (CEO + juridique)

**Montage du wallet FeexPay** — deux options, déjà esquissées comme pistes de
mitigation BCEAO dans ADR-018/019 :

- **(A) Wallet marchand unique au nom de Ranti.** Le reçu PSP affiche « Ranti ».
  Simple à mettre en place, mais : (i) qualification « pour compte de tiers » la
  plus exposée réglementairement, (ii) nom marchand déroutant pour le locataire.
  Impose d'assumer « paiement traité par Ranti » dans toute la copie.
- **(B) Sous-comptes / wallets par propriétaire** (piste (b) du caveat ADR-018).
  Le reçu PSP peut alors afficher le propriétaire (ou « … pour le compte de
  M. X »). **Résout d'un coup** le risque réglementaire *et* le risque de
  confusion du nom marchand. Dépend de ce que FeexPay permet (à confirmer au
  contrat/partenariat art. 7).

**Recommandation : viser (B).** C'est le seul montage qui aligne conformité
BCEAO et clarté locataire. (A) reste le repli si FeexPay n'offre pas les
sous-comptes — au prix d'une copie « paiement traité par Ranti » explicite.

## Principes de design (indépendants du montage retenu)

Ces règles tiennent quelle que soit l'option A/B — à appliquer quand on écrira
`/confirmer` :

1. **Une seule preuve Ranti post-paiement : la quittance.** Ne pas réémettre un
   « reçu de paiement » Ranti qui doublonnerait le reçu PSP. La quittance
   (ADR-007) reste le document canonique qui fait foi.
2. **Poser l'attente dans le message de paiement.** « Après paiement, vous
   recevrez votre quittance Ranti — le reçu qui fait foi. » Ne jamais présenter
   le reçu PSP comme la quittance.
3. **Wording honnête (DESIGN.md).** Pas de claim non tenu : tant que le gate
   BCEAO n'est pas levé, aucune promesse de « payez ici » qui n'aboutit pas. Le
   nom affiché (Ranti vs propriétaire) découle du montage — écrire la copie
   **après** la décision A/B.
4. **Le rail simplifie le parcours locataire.** Il retire l'étape « je déclare
   avoir payé » de `/confirmer` (le webhook ingère). Le locataire a *moins* de
   gestes qu'avec l'alias, pas plus.

## Conséquences

- Écrire le déclenchement du checkout `/confirmer` est **prématuré** tant que le
  montage A/B n'est pas tranché et que les endpoints sandbox FeexPay ne sont pas
  confirmés (ADR-019). La copie dépend directement de A/B.
- La décision montage est un **prérequis de la levée du gate BCEAO** : elle
  n'est pas qu'esthétique (nom marchand), elle porte la conformité.
- Aucune contrainte nouvelle sur la quittance : elle reste la preuve qui fait
  foi, générée à la validation propriétaire (ADR-007), contestable (ADR-013).

## Liens

Précise ADR-019 (rail unique, gate BCEAO) et ADR-018 (interface / caveat BCEAO).
S'appuie sur ADR-007 (quittance = conséquence de la validation) et ADR-013
(contestation). À trancher avant la copie `/confirmer` et la mise en production
du payout.
