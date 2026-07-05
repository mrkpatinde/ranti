# ADR-009 — Alias de paiement PI-SPI du propriétaire (Tier 1)

## Statut

Acceptée — 2026-07-05.

## Contexte

PI-SPI est la plateforme interopérable de paiement instantané de la BCEAO
(UEMOA), lancée le 30/09/2025. Elle permet à un client de payer instantanément
et gratuitement vers un **alias** (numéro de téléphone ou adresse de paiement)
depuis n'importe quelle banque ou wallet connecté.

Au Bénin, MTN MoMo est connecté depuis le 28/06/2026 ; avec Moov Money et les
banques, la couverture côté locataire est suffisante pour un usage réel.

Jusqu'ici, dans Ranti, le paiement se fait **hors produit** : le propriétaire
reçoit le loyer (espèces, Mobile Money) puis enregistre l'encaissement. Le
modèle de domaine et le glossaire ne connaissaient aucun canal de paiement.
Cette ADR comble ce vide (« gap docs ») de façon additive.

Deux paliers étaient possibles :

- **Tier 1** : afficher l'alias du propriétaire au locataire ; le paiement reste
  P2P hors Ranti, puis déclaré/encaissé comme aujourd'hui.
- **Tier 2** : générer une vraie demande de paiement (RTP) via l'API Business
  d'un participant, avec réconciliation par webhook. Nécessite un participant
  béninois dont l'API Business est **homologuée BCEAO** (agrément distinct, non
  confirmé à ce jour).

## Décision

1. On livre **Tier 1** maintenant. Le propriétaire renseigne un alias PI-SPI
   (numéro ou adresse) dans un écran de réglages dédié (`/settings/payment`).
2. L'alias est une **donnée mutable**, distincte de l'identité verrouillée
   (ADR-002 ne verrouille que civilité/prénom/nom/téléphone). Il vit sur
   `landlords.payment_alias` (+ `payment_alias_type`).
3. L'alias s'affiche :
   - au propriétaire, sur l'écran d'encaissement (`/collections/new`) ;
   - au locataire, sur la page publique `/confirmer/[token]`, exposé par la RPC
     `get_rent_due_by_token` (SECURITY DEFINER, scope token). Seul l'alias est
     ajouté à la réponse ; il est par nature destiné au payeur.
4. **Ranti ne détient jamais les fonds.** Le paiement va directement de compte à
   compte via PI-SPI. Ranti n'est ni agrégateur, ni EME, ni établissement de
   paiement — donc **aucun agrément n'est requis**.
5. **Report volontaire** : l'injection de l'alias dans le message de relance
   sortant (SMS/WhatsApp) n'est **pas** faite. Elle toucherait ADR-006, le cron
   et le dépôt `ranti-ops` (pipeline de relances live, cross-repo) pendant le gel
   features — risque jugé supérieur au gain, d'autant que le locataire voit déjà
   l'alias en ouvrant le lien `/confirmer` contenu dans chaque relance.

## Conséquences

- Nouveau terme au glossaire : « Alias PI-SPI ».
- Le locataire dispose d'une instruction de paiement claire sans que Ranti
  n'entre dans le flux financier ; l'invariant « Ranti enregistre la mémoire des
  loyers, il n'encaisse pas » (modèle de domaine) est préservé.
- **Tier 2 (RTP + webhook)** reste ouvert : il fera l'objet d'une ADR séparée une
  fois qu'un participant béninois exposera une API Business homologuée. Échéance
  d'obligation de connexion des banques/EME : 30/09/2026.
- Migration `20260705140000_landlord_payment_alias.sql` (additive, idempotente).
