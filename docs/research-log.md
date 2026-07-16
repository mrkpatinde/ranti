# Ranti — Research Log

## Statut

Version 0.1 — aucune validation terrain documentée pour l'instant.

Ce fichier sert à empêcher Ranti d'être construit uniquement sur des hypothèses internes.

## Règle

Une hypothèse produit devient plus fiable seulement si elle est reliée à une observation terrain, un entretien, un test de maquette ou une preuve d'usage.

Les user flows, personas et choix UX restent des hypothèses tant qu'ils ne sont pas reliés à ce fichier.

## Questions terrain prioritaires

1. Combien de logements le propriétaire gère-t-il ?
2. Comment suit-il les loyers aujourd'hui ?
3. Comment sait-il qui est en retard ?
4. Comment reçoit-il les preuves de paiement ?
5. Comment produit-il un reçu ?
6. À quel moment oublie-t-il de rappeler ou relancer ?
7. Qu'est-ce qui crée le plus de conflits ?
8. Quel outil utilise-t-il le plus : registre, WhatsApp, Excel, appels ?
9. Accepterait-il de saisir ou confirmer chaque paiement dans Ranti ?
10. Accepterait-il que Ranti prépare ou envoie les rappels/relances à partir du bail ?
11. Le locataire devrait-il interagir avec Ranti ou seulement recevoir des messages/documents ?
12. Quel serait le moment exact où Ranti lui ferait gagner du temps ?

## Format d'entrée

```txt
Date :
Lieu / canal :
Profil : propriétaire / locataire / gestionnaire
Nombre de logements :
Méthode actuelle : registre / WhatsApp / Excel / appels / autre

Ce qui a été dit ou observé :
-
-
-

Douleurs concrètes :
-
-

Réactions à Ranti :
-
-

Réactions aux relances automatiques :
-
-

Réactions aux reçus/quittances automatiques :
-
-

Questions ou objections :
-
-

Décision produit possible :
-

Niveau de confiance : faible / moyen / fort
```

## Entrées

```txt
Date : 2026-07-10
Lieu / canal : OSINT desk research (méthode : docs/methode-osint.md)
Profil : marché propriétaires Bénin (sources ouvertes, pas d'entretien direct)
Nombre de logements : n/a
Méthode actuelle : démarcheur + carnet papier + paiement trimestriel cash/mobile money

Ce qui a été dit ou observé :
- ~75 % des annonces locatives passent par démarcheurs informels sur Facebook/WhatsApp/TikTok (La Marina BJ 2025).
- Arnaques immobilières récurrentes via WhatsApp/mobile money ; alertes CNIN → méfiance digitale forte, héritée du mobile money.
- Impayés judiciarisés et médiatisés (condamnation 1 940 000 FCFA, La Nouvelle Tribune 2025) → besoin de preuve horodatée.
- Agences (BENIN HOUSE, GEST-IONN, BENIN-IMMO) facturent 8–15 % du loyer pour gestion complète ; personne ne sert le propriétaire auto-gérant 1–10 unités.
- Vocabulaire terrain : « avance » (3 mois prépayés), « caution » (plafond 3 mois, art. 59 loi 2018-12), « prépayés », « trimestre », « démarcheur » (Matin Libre 2023).
- Cadre légal : loi 2018-12, loi 2022-30, arrêté 2022-0120 (contrat type), Code du numérique 2017-20 + APDP.
- Quittance formelle = besoin locataire (banque, visa, justificatif domicile) → levier viral.

Décision produit possible :
- Positionnement : contrôle + preuve pour l'auto-gérant, jamais « digitalisez-vous ».
- Quittance gratuite illimitée avec QR de vérification = cheval de Troie viral ; payant = registre/relances/historique.
- Enregistrement APDP + « Ranti n'encaisse rien » affichés comme arguments de confiance.
- Démarcheurs = canal de distribution (parrainage), pas concurrent à contourner.

Niveau de confiance : moyen (sources ouvertes convergentes, à valider par entretiens terrain)
```

## Entrée terrain n° 1 — 2026-07-10

```txt
Date : 2026-07-10
Lieu / canal : appel téléphonique (CEO)
Profil : propriétaire
Nombre de logements : 6 chambres dans une maison unique
Méthode actuelle : WhatsApp

Portefeuille :
- 1 maison, 6 chambres, située à Calavi.
- Elle réside à Èkpè. Propriétaire NON résidente sur le bien (distance ~25 km).

Ce qui a été dit :
- Suit ses loyers via WhatsApp.
- Plainte n° 1 : les locataires paient par Mobile Money « sans les frais de
  retrait », ou n'en paient qu'une partie. Elle reçoit donc moins que le loyer dû.
- Un impayé a couru sur 6 mois.
- Elle ne relance « que quand ça dure ».
- Elle envoie les quittances en photo par WhatsApp.
- Encaissements : Mobile Money majoritaire, espèces rarement, virement presque
  jamais — alors qu'elle voulait le virement au départ.
- Prix : prête à payer 500 FCFA par loyer et par mois « pour le moment ».
- Elle a été recommandée par UNE DE SES LOCATAIRES, qui lui avait déjà parlé de
  Ranti avant l'appel du CEO.
```

**Ce que cette entrée valide :**

- La chambre est l'unité locative réelle (§ 4.2 de `design/infrastructure-note.md`).
  6 chambres = 6 baux, 1 propriété, 1 logement au sens naïf. Le modèle `unit` =
  « logement » aurait produit 1 seul objet.
- Le propriétaire cible est **non résident sur son bien**, et non le
  *household landlord* que décrit la Banque mondiale. La distance est le moteur du
  besoin. Persona à corriger.
- Le paiement partiel est bien la norme, mais pour une raison qu'aucun rapport
  n'avait donnée : **les frais de retrait Mobile Money sont déduits du loyer.**
  Le montant reçu ≠ le montant dû, à chaque échéance, structurellement.
- La relance tardive est confirmée (« que quand ça dure », impayé à 6 mois).
- La quittance photo WhatsApp est confirmée comme pratique réelle.
- Le levier viral prédit par l'entrée OSINT est confirmé : **le canal
  d'acquisition a été le locataire, pas le propriétaire.**

**Ce que cette entrée invalide :**

- La grille 2 000 / 5 000 / 10 000 FCFA par mois et par compte. Le prix spontané
  est **par logement** : 500 FCFA × 6 = 3 000 FCFA/mois. Le propriétaire raisonne
  à l'unité locative, pas à l'abonnement.

**Confiance :** 1 entretien. Aucune généralisation possible. À confronter aux 9
suivants.

## Synthèse actuelle

Une entrée OSINT (2026-07-10) et une entrée terrain (2026-07-10).

## Décisions issues du terrain

- `unit.kind` (maison / appartement / chambre / lit) devient nécessaire :
  entrée terrain n° 1. Exception au gel features ratifiée par le CEO le 2026-07-10.
- Hypothèse de tarification à l'unité locative (et non à l'abonnement) à tester
  sur les 9 entretiens suivants. Contrainte non négociable : un prix **fixe par
  logement**, jamais un pourcentage du loyer (loi 2022-30, régime de l'agent
  immobilier — voir `design/infrastructure-note.md` § 2.2).
- L'alias PI-SPI (ADR-009, Tier 1) répond directement à la plainte n° 1 : un
  transfert PI-SPI est instantané et gratuit. Argument de vente à tester tel quel.

## À ne pas faire

- Ne pas transformer une intuition en vérité produit.
- Ne pas écrire "les propriétaires veulent" sans entrée terrain liée.
- Ne pas considérer une maquette comme validée parce qu'elle est jolie.
- Ne pas confondre préférence personnelle et usage réel.
