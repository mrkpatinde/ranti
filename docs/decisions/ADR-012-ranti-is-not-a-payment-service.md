# ADR-012 — Ranti n'est pas un prestataire de services de paiement

## Statut

Proposée — 2026-07-10. Amende partiellement [ADR-009](ADR-009-pispi-payment-alias.md).

## Contexte

ADR-009 (point 4) affirme :

> « Ranti ne détient jamais les fonds. […] Ranti n'est ni agrégateur, ni EME, ni
> établissement de paiement — donc aucun agrément n'est requis. »

Le raisonnement implicite est : *pas de détention de fonds ⇒ pas d'agrément*.
La lecture de l'Instruction BCEAO n° 001-01-2024 du 23 janvier 2024 montre que
cette implication est fausse.

- **Article 4** énumère les services de paiement. Le point **vii)** est
  « les services d'initiation de paiement » ; le point viii) « les services
  d'agrégation de comptes ou d'information sur les comptes ».
- **Article 9** : « Nul ne peut, sans avoir été préalablement agréé et inscrit sur
  la liste des établissements de paiement prévue à l'article 19, fournir les
  services de paiement visés aux points **i) à vii)** de l'article 4. »
  L'initiation de paiement est donc **soumise à agrément**. L'agrégation de comptes
  relève d'un enregistrement préalable distinct.
- **Article 30** : les prestataires de services d'initiation de paiement « ne
  doivent pas détenir, à aucun moment, les fonds du payeur ».
- **Article 11** — capital social minimum : agrégation seule 10 M FCFA ;
  **initiation seule 20 M FCFA** ; initiation + agrégation 30 M FCFA ; au moins un
  des services i) à vi) 100 M FCFA.
- **Article 7** : les prestataires peuvent nouer des partenariats de prestation de
  services, et **les clauses d'exclusivité sont interdites**.

La non-détention des fonds n'est pas une exemption : c'est une **obligation
imposée** à ceux qui exercent l'activité réglementée d'initiation.

La période transitoire de mise en conformité est close depuis le **1er mai 2025**.

## Décision

1. **Ranti est un registre de loyer. Ranti n'est pas un prestataire de services de
   paiement au sens de l'article 4 de l'Instruction n° 001-01-2024.**

2. En conséquence, Ranti **n'initie aucune opération de paiement**. Concrètement,
   il est interdit à Ranti :
   - de déclencher une demande de paiement (RTP) auprès d'un établissement
     gestionnaire de compte, pour le compte d'un propriétaire ou d'un locataire ;
   - d'agréger ou de restituer les soldes ou historiques de comptes de paiement
     d'un utilisateur ;
   - d'émettre ou de distribuer de la monnaie électronique ;
   - de détenir, de séquestrer ou de faire transiter des fonds, à aucun moment ;
   - de se prévaloir de la qualité d'établissement de paiement, ou d'en créer
     l'apparence (article 9, dernier alinéa).

3. **Ce que Ranti fait, et qui n'est pas un service de paiement :**
   - afficher l'alias PI-SPI du propriétaire au locataire (Tier 1, ADR-009) ;
   - enregistrer un encaissement déclaré et confirmé par un humain ;
   - réconcilier a posteriori un encaissement avec une échéance ;
   - générer une quittance déterministe.

4. **ADR-009 est amendée.** Son point 4 reste valide pour le Tier 1. Il ne peut
   **pas** être invoqué pour le Tier 2 (RTP + webhook) : le Tier 2, tel que
   décrit, constitue un service d'initiation de paiement.

5. **Le Tier 2 n'est réalisable que par l'une de ces voies :**
   - **(a) Partenariat (article 7).** Un prestataire agréé (banque, EME,
     établissement de paiement) fournit le service d'initiation ; Ranti intervient
     comme partenaire ou sous-traitant technique, sans jamais être désigné comme
     PSP. L'interdiction des clauses d'exclusivité permet à Ranti de contracter
     avec plusieurs partenaires. **Voie recommandée.**
   - **(b) Agrément.** Établissement de paiement, service d'initiation seul :
     20 M FCFA de capital intégralement souscrit et libéré, société commerciale
     (non unipersonnelle) constituée dans un État de l'UMOA, honorabilité et
     compétence des dirigeants. À n'envisager que si l'initiation devient le
     produit.
   - **(c) Statu quo.** Rester au Tier 1. C'est suffisant pour tenir la promesse
     produit actuelle.

6. Toute ADR future qui introduit un flux financier doit **citer l'article de
   l'Instruction n° 001-01-2024** sous lequel elle se range, ou expliquer pourquoi
   l'Instruction ne s'applique pas.

## Conséquences

- Le principe 7 des principes d'architecture (« prestataires externes
  remplaçables ») acquiert une justification réglementaire, et pas seulement
  technique : l'adaptateur de paiement est aussi la frontière d'agrément.
- Le glossaire doit distinguer « initier un paiement » (interdit) de
  « enregistrer un encaissement » (cœur du produit).
- Une revue juridique béninoise est nécessaire avant toute discussion de
  partenariat au titre de l'article 7.
- Aucun changement de code n'est requis aujourd'hui : le Tier 1 est conforme.

## Sources

- BCEAO, Instruction n° 001-01-2024 du 23 janvier 2024 relative aux services de
  paiement dans l'UMOA (articles 4, 5, 7, 9, 11, 30).
- BCEAO, Avis n° 006-05-2025 relatif à la période transitoire de mise en
  conformité.
