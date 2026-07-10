# Note de design — Ranti comme infrastructure du loyer

## Statut

Version 1.0 — 2026-07-10. Note de design, pas encore une décision.
Les décisions qui en découlent sont isolées dans `docs/decisions/` (ADR-012).

Cette note s'appuie sur quatre corpus externes et deux textes de droit positif.
Elle ne remplace ni `docs/vision.md` ni `docs/architecture-principles.md` : elle
en teste la solidité face aux données du marché et à la loi.

## 1. Ce que dit l'extérieur

### 1.1 Banque mondiale — le locatif est le marché, pas une niche

- Le locatif représente **51,4 % du marché immobilier africain** (2025).
- **Moins de 5 % des adultes** d'Afrique subsaharienne détiennent un crédit
  hypothécaire formel.
- Le *household landlordism* — louer une chambre ou un lit dans le logement où
  l'on habite soi-même — est une part majeure de l'économie locative. Zimbabwe :
  42,7 % des ménages urbains sont « lodgers ». Ouganda (quartiers précaires) :
  56 % des logements occupés par des locataires. Tanzanie : ~80 % des locataires
  en logement partagé.
- Les ménages consacrent **43,5 % de leur revenu** au logement.

### 1.2 ONU-Habitat — le titre foncier n'existe pas

- 60 %+ des urbains africains vivent en habitat informel ; ~75 % du stock de
  logement subsaharien est informel.
- **Moins de 1 % des terres subsahariennes sont enregistrées** avec un titre.
- 55 % des ménages subsahariens dépassent 30 % du revenu en loyer.

### 1.3 BCEAO — le rail est en train de se refermer

- 130 M+ comptes mobile money dans l'UEMOA (2024), dont **~40 % actifs**.
- Les télécoms concentrent **80 %+ des transactions électroniques**.
- **PI-SPI** : lancé le 30/09/2025, **obligatoire depuis le 30/06/2026**.
- **Instruction n° 001-01-2024** : refonte du régime des services de paiement,
  période de mise en conformité close au **1er mai 2025**. Voir § 3.

### 1.4 IFC — la donnée de paiement est le verrou

- IFC : 7 Md$ engagés dans le financement du logement depuis 2000.
- Leviers identifiés : sociétés de refinancement hypothécaire (MRC),
  **location-accession (rent-to-own)**, construction verte.
- Le blocage n'est pas la demande de logement : c'est **l'absence d'historique de
  paiement scorable** chez l'emprunteur du secteur informel.

## 2. Ce que dit la loi béninoise

### 2.1 Loi n° 2022-30 du 20 décembre 2022 (bail à usage d'habitation)

141 articles, 7 titres. Points structurants pour Ranti :

| Règle | Conséquence produit |
| --- | --- |
| Le contrat de bail **doit être écrit et signé** par les deux parties | Le bail Ranti doit pouvoir référencer un écrit, pas s'y substituer |
| L'**état des lieux d'entrée** doit être annexé au bail | Objet de domaine manquant (`lease_inventory`) |
| Le loyer est payable **contre reçu** | La quittance Ranti n'est pas un confort : elle matérialise une obligation légale |
| Cautionnement = **3 mois de loyer**, non révisable en cours de bail, remboursé en fin de bail (art. 69-71) | Objet de domaine manquant (`deposit`), avec restitution |
| Manquement financier → **mise en demeure par LRAR**, puis tribunal | La relance Ranti n'est **pas** une mise en demeure. Ne jamais laisser croire l'inverse |
| Le bailleur **ne peut pas expulser lui-même** ; seul un huissier le peut | Aucun langage d'expulsion dans le produit |
| Le loyer s'applique aux **maisons, appartements ou chambres** | La chambre est une unité locative de plein droit |
| **Location-accession** : titre V, 39 articles, acte notarié ou sous seing privé déposé au rang des minutes d'un notaire | Le rent-to-own de l'IFC **existe déjà en droit béninois** |

### 2.2 Le piège « agent immobilier » (loi 2022-30)

Pour exercer comme agent immobilier au Bénin : nationalité béninoise, conditions
de la profession commerciale, inscription au registre des agents immobiliers,
carte professionnelle, assurance professionnelle.

Et les commissions sont plafonnées :

- simple mise en relation : **≤ 50 % d'un loyer mensuel** ;
- **gestion d'une unité locative au nom et pour le compte d'un bailleur : ≤ 10 %
  du loyer mensuel**.

> **Alerte.** Le cockpit `ranti-ops`, dans lequel un opérateur Ranti saisit des
> encaissements à la place du propriétaire, se rapproche dangereusement de la
> « gestion au nom et pour le compte d'un bailleur ». Tant que l'opérateur agit
> comme **support de saisie sur instruction du propriétaire, sans mandat, sans
> encaisser, et sans rémunération indexée sur le loyer**, on reste hors du régime.
> Le jour où Ranti facture un pourcentage du loyer ou reçoit mandat de gérer, on
> bascule dans le régime de l'agent immobilier. Cette frontière doit rester
> explicite dans les CGU et dans le contrat opérateur.

### 2.3 Loi n° 2017-20 (code du numérique), Livre V

Encadre la collecte, le traitement, la transmission, la conservation et
l'utilisation des données personnelles. Autorité de contrôle : **APDP**, dotée de
pouvoirs d'enquête et de sanction, et compétente pour instruire les demandes
relatives aux traitements.

Ranti traite des données de locataires qui ne sont pas ses clients et qui n'ont
pas de compte. C'est le point d'exposition principal.

## 3. Le point réglementaire qui change une décision existante

`ADR-009` (Alias de paiement PI-SPI) énonce :

> « Ranti ne détient jamais les fonds. […] Ranti n'est ni agrégateur, ni EME, ni
> établissement de paiement — donc aucun agrément n'est requis. »

**C'est exact pour le Tier 1** (afficher l'alias du propriétaire ; le paiement se
fait hors Ranti). **C'est faux pour le Tier 2** tel qu'il est esquissé.

Instruction BCEAO n° 001-01-2024 :

- **Article 4** liste les services de paiement. Le point **vii) est « les services
  d'initiation de paiement »**, le point viii) « l'agrégation de comptes ».
- **Article 9** : « Nul ne peut, sans avoir été préalablement agréé et inscrit sur
  la liste des établissements de paiement […], fournir les services de paiement
  visés aux points **i) à vii)** de l'article 4. » L'agrégation de comptes relève
  d'un **enregistrement** distinct.
- **Article 11** — capital social minimum :
  - agrégation de comptes seule : **10 M FCFA** ;
  - **initiation de paiement seule : 20 M FCFA** ;
  - initiation + agrégation : 30 M FCFA ;
  - au moins un des services i) à vi) : 100 M FCFA.
- **Article 30** : les prestataires de services d'initiation de paiement **ne
  doivent pas détenir, à aucun moment, les fonds du payeur**.

La lecture correcte est donc :

> **Ne pas détenir les fonds n'est pas une exemption. C'est une condition
> d'exercice d'une activité qui, elle, est réglementée.**

Déclencher une demande de paiement (RTP) au nom du propriétaire, c'est initier une
opération de paiement. Sans agrément, c'est interdit — même sans jamais toucher un
franc.

**Trois sorties possibles, par ordre de coût :**

1. **Ne pas initier.** Ranti affiche l'alias, enregistre, réconcilie. Le paiement
   est déclenché par le locataire depuis son wallet. Ranti reste un *registre*.
   Coût : 0. C'est le Tier 1, et il suffit pour la promesse produit actuelle.
2. **Partenariat / externalisation (art. 7).** Un prestataire agréé (banque, EME)
   fournit le service d'initiation ; Ranti est son partenaire technique. L'article
   7 **interdit les clauses d'exclusivité** — Ranti peut donc contracter avec
   plusieurs. C'est la voie « infrastructure » sans bilan réglementaire.
3. **Agrément d'établissement de paiement, initiation seule : 20 M FCFA** de
   capital, plus honorabilité et compétence des dirigeants. À n'envisager que si
   l'initiation devient le produit.

`ADR-009` doit être amendée : son point 4 est correct pour le Tier 1 mais ne peut
pas être invoqué pour le Tier 2.

## 4. Ce que le croisement dit de l'architecture

### 4.1 Ce qui est déjà juste, et pourquoi

| Choix Ranti | Confirmé par |
| --- | --- |
| Le bien est déclaré par le propriétaire, sans dépendance à un cadastre | ONU-Habitat : < 1 % de terres titrées |
| Encaissement partiel de première classe (`rent_reception_allocations`, `amount_remaining`) | Banque mondiale : 43,5 % du revenu au loyer ⇒ le paiement fractionné est la norme |
| Validation humaine du paiement (principe 6) | BCEAO : 40 % de wallets actifs ⇒ le cash reste le rail dominant |
| Prestataires externes = adaptateurs (principe 7) | BCEAO : interopérabilité obligatoire ⇒ un rail, pas N intégrations telco |
| Quittance déterministe (principe 11) | Loi 2022-30 : le loyer est payable contre reçu |

Le paiement partiel est l'avantage structurel de Ranti. Tout concurrent qui
modélise « loyer payé : oui/non » est faux dans 43 % des cas.

### 4.2 Ce qui manque

1. **Granularité de l'unité locative.** `unit` = « logement » est trop grossier.
   La loi reconnaît la chambre ; le marché est majoritairement en chambres et en
   logement partagé. Ajouter `unit.kind` (`house` | `apartment` | `room` | `bed`)
   et un booléen `property.owner_resides` (household landlordism). C'est une
   colonne aujourd'hui, une migration douloureuse après 100 propriétaires.

2. **Le cautionnement.** Trois mois de loyer, non révisable, restituable. C'est de
   l'argent que le propriétaire doit et qu'aucun registre papier ne suit. C'est
   probablement la fonctionnalité la plus demandée que personne n'a construite.

3. **L'état des lieux.** Annexe légale obligatoire du bail. Un objet
   `lease_inventory` avec photos suffit ; il alimente ensuite la restitution du
   cautionnement.

4. **L'historique de paiement comme actif.** Voir § 5.

### 4.3 Ce qui doit être écrit avant d'être oublié

- L'identité d'un locataire ne doit **jamais** avoir le numéro de téléphone pour
  clé. 130 M comptes pour 40 % actifs = rotation de SIM massive. Identifiant
  opaque, téléphone en attribut mutable et historisé.
- La relance n'est pas une mise en demeure. Vocabulaire à figer au glossaire.
- Aucune fonctionnalité d'expulsion, jamais.

## 5. La thèse « infrastructure »

L'IFC dit que le financement du logement africain bute sur l'absence
d'historique de paiement scorable. Ranti produit exactement cet historique :
échéances générées depuis le bail, encaissements confirmés, allocations,
quittances déterministes, traces d'audit.

La loi béninoise a déjà créé le véhicule de sortie : la **location-accession**
(titre V de la loi 2022-30). Un locataire qui a payé 36 échéances documentées est
le dossier qu'une banque ne peut pas construire aujourd'hui.

**À qui Ranti peut se brancher, et dans quel ordre :**

| Contrepartie | Ce qu'elle veut | Ce que Ranti apporte | Prérequis |
| --- | --- | --- | --- |
| **Telco / EME** | Volume de transactions, alias actifs | Un motif de paiement récurrent, daté, réconcilié | Partenariat art. 7. Aucun agrément si Ranti n'initie pas |
| **Banque / IMF** | Dossiers scorables, dépôts | Historique de loyer vérifié, consenti, exportable | Consentement explicite du locataire. Format d'export stable |
| **Assurance** | Risque locatif mesurable (impayés, garantie loyer) | Taux de défaut réel par bail, par zone | Anonymisation ou consentement. Ranti n'est pas courtier |
| **Gouvernement** | Assiette fiscale, statistiques du logement, application de la loi 2022-30 | Statistiques agrégées, jamais nominatives | **Danger.** Voir ci-dessous |

> **Sur le branchement gouvernemental.** C'est le plus séduisant et le plus
> dangereux. Un registre de loyers consultable par l'administration fiscale
> détruit la confiance des propriétaires en un trimestre, et expose les locataires
> informels à un risque qu'ils n'ont pas choisi. La position de Ranti doit être
> écrite dès maintenant : **agrégats anonymisés, jamais de données nominatives,
> jamais d'accès direct, réquisition judiciaire uniquement, et notification de la
> personne concernée lorsque la loi le permet.** Ce paragraphe doit survivre à
> toutes les négociations. Il est dans les CGU (art. 11) et dans la politique de
> confidentialité (§ 6).

**L'ordre compte.** Une plateforme se branche à d'autres quand elle a une densité
de données que personne d'autre n'a. Aujourd'hui, Ranti a zéro client payant et un
sprint de preuve terrain en cours. La thèse infrastructure est la bonne
*direction*, mais elle ne doit pas devenir un *chantier* avant que le registre
lui-même ne soit adopté. Le seul travail d'infrastructure justifié maintenant est
celui qui coûte cher plus tard : le modèle de données, le consentement, la
portabilité.

## 6. Ce qu'on fait maintenant, et ce qu'on ne fait pas

**Maintenant (coût faible, coût de report élevé) :**

1. `unit.kind` + `property.owner_resides` — une migration additive.
2. Consentement du locataire au traitement, tracé et daté, avec finalité. Sans
   lui, aucun partenariat bancaire n'est possible et l'APDP est fondée à
   sanctionner.
3. CGU + politique de confidentialité publiées (voir `docs/legal/`).
4. Amender ADR-009 sur le point réglementaire du Tier 2.

**Pas maintenant :**

- API partenaires, webhooks sortants, portail banque.
- Initiation de paiement (RTP), tant qu'il n'y a pas de partenaire agréé.
- Scoring de crédit. Ranti produit la donnée ; il ne prête pas et ne note pas.
- Cautionnement et état des lieux : justes, mais hors du gel features en cours.

## 7. Ce qu'il faut vérifier avec un avocat béninois

Cette note est une analyse d'ingénierie, pas un avis juridique.

1. La frontière exacte entre « support de saisie » et « gestion pour le compte du
   bailleur » (loi 2022-30) pour le cockpit `ranti-ops`.
2. Les formalités APDP : déclaration ou autorisation préalable du traitement,
   selon la nature des données.
3. Le statut de la quittance générée par Ranti au regard du « reçu » exigé par la
   loi : signature électronique requise ou non (le code du numérique régit les
   services de confiance).
4. La validité du consentement d'un locataire recueilli via un lien SMS.

## Sources

- Banque mondiale — *Stocktaking of the Housing Sector in Sub-Saharan Africa* ;
  *Housing and Urbanization in Africa*.
- ONU-Habitat — *World Cities Report 2026: The Global Housing Crisis* ;
  *Affordable Land and Housing in Africa*.
- BCEAO — *Instruction n° 001-01-2024 du 23 janvier 2024 relative aux services de
  paiement dans l'UMOA* ; *Rapport annuel sur les services financiers numériques
  dans l'UEMOA* ; Avis n° 006-05-2025 (période transitoire).
- IFC — *Scaling Housing Finance in Africa* ; *Her Home II*.
- République du Bénin — Loi n° 2022-30 du 20 décembre 2022 ; Loi n° 2017-20 du
  20 avril 2018 (code du numérique), Livre V.
