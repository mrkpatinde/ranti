# Ranti — Research Log

## Statut

Version 0.2 — un entretien direct propriétaire (2026-07-17) + une entrée OSINT (2026-07-10).

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

```txt
Date : 2026-07-17
Lieu / canal : Entretien direct (conversation) — 1re proprio interviewée
Profil : propriétaire (auto-gérante, à distance)
Nombre de logements : maison locative à Calavi, plusieurs locataires (nombre exact non relevé — à préciser)
Méthode actuelle : WhatsApp (« accusé de réception ») + mémoire ; un autre proprio évoqué gère tout dans Excel, jamais de reçu

Ce qui a été dit ou observé :
- Elle réside à Sèmè-Podji ; la maison locative est à Calavi → gestion à distance (~50 km, l'agglo de Cotonou entre les deux).
- Litige serrure : des locataires ont cassé la serrure du portail et l'appellent pour la réparation ; elle devait « normalement » répercuter le coût sur le loyer, mais rien n'est tracé.
- Frais de retrait Mobile Money : des locataires paient parfois sans couvrir les frais de retrait, ou seulement une partie → elle touche moins que le loyer dû, écart jamais réconcilié.
- Preuve informelle : elle « accuse réception sur WhatsApp » ; une de ses locataires se plaint de ne pas recevoir de reçu (demande tirée côté locataire).
- Un autre propriétaire de son entourage gère tout dans Excel et n'émet jamais de reçu.
- Impayés lourds : certains locataires lui doivent plus de 3 mois de loyer, « parce qu'elle a relancé en retard » et « qu'elle est trop maternelle avec les locataires ».

Douleurs concrètes :
- Relance tardive → dette locative accumulée (3+ mois ≈ 150 000 F par locataire à 50 000 F/mois d'ordre de grandeur).
- Coût social de la relance : elle n'ose pas relancer fermement (« trop maternelle ») → l'inaction lui coûte des mois de loyer. La friction est émotionnelle, pas informationnelle.
- Écart montant dû / montant reçu (frais MoMo, réparations) jamais réconcilié → « reste dû » flou.
- Aucune preuve opposable ; l'accusé WhatsApp est ambigu, dispersé, non horodaté proprement.
- Gestion à distance (Sèmè→Calavi) aggrave tout : ni présence, ni contrôle, ni remise de reçu en main propre.

Réactions à Ranti :
- Non testé sur maquette dans cet échange — à faire au prochain contact (montrer registre + relance-type + quittance QR).

Réactions aux relances automatiques :
- Pas de réaction directe à Ranti encore, mais signal fort déduit : le besoin d'une relance automatique ET impersonnelle est explicite — elle échoue à relancer précisément parce que c'est elle, en personne, qui doit le faire.

Réactions aux reçus/quittances automatiques :
- Demande réelle des deux côtés : une locataire réclame un reçu ; la quittance auto répond à un besoin déjà exprimé (et alimente la boucle de recommandation).

Questions ou objections :
- À recueillir au prochain contact : accepterait-elle que la relance parte automatiquement en son nom ? Combien valoriserait-elle un mois de loyer récupéré ? Paierait-elle un abonnement pour ça ?

Décision produit possible :
- Reminder Engine = BOUCLIER ÉMOTIONNEL, pas seulement rappel. La relance doit paraître venir « du registre / du système », jamais d'elle personnellement, pour lever le coût social. C'est le cœur de la valeur, à mettre en avant dans le pitch et la landing.
- Valeur chiffrable : « Ranti récupère les mois de loyer que la relance tardive fait perdre » → argument de vente + futur KPI M2 (vélocité / délai de retard).
- Règle de bail « frais de retrait à la charge de qui » → l'écart montant reçu vs dû est classé automatiquement, pas arbitré par Ranti.
- Ajustement mensuel générique avec libellé libre (ex. « réparation portail −5 000 ») → le registre reste juste sans devenir une compta de charges.
- Ranti enregistre, n'arbitre pas : la contestation locataire (ADR-013) est le SEUL primitif de litige. Pas de recouvrement, pas de compta réparations, pas de tribunal.
- Persona « propriétaire à distance » (Sèmè→Calavi) à élever au rang de cible étudiée — proche du cas diaspora, même douleur de contrôle à distance.

Niveau de confiance : moyen-fort (entretien direct unique, signaux convergents avec l'OSINT du 10/07 ; à répliquer sur ~10 propriétaires, surtout gestion à distance).
```

## Synthèse actuelle

Deux entrées : OSINT (2026-07-10) + 1 entretien direct propriétaire (2026-07-17).

Convergence forte entre les deux sur : besoin de preuve/quittade opposable, méfiance/informalité (WhatsApp, Excel), et coût des impayés. L'entretien ajoute un signal que l'OSINT ne pouvait pas voir : **la relance n'est pas un problème d'oubli mais de coût social** (« trop maternelle ») — ce qui repositionne le Reminder Engine comme bouclier émotionnel et non comme simple automatisation.

Toujours insuffisant pour verrouiller une décision : 1 entretien ≠ validation. Objectif : 10 entretiens, dont plusieurs propriétaires gérant à distance.

## Décisions issues du terrain

Aucune décision verrouillée (seuil : convergence sur plusieurs entretiens). Signaux forts à confirmer :

1. **Reminder Engine positionné comme bouclier émotionnel** (relance impersonnelle « du système ») — source : entretien 17/07. À confirmer sur 3+ propriétaires.
2. **Argument de vente chiffré** : mois de loyer récupérés par relance à temps — source : entretien 17/07 (3+ mois de dette observés).
3. **Règle de bail sur les frais de retrait** pour réconcilier l'écart reçu/dû — source : entretien 17/07.
4. **Persona propriétaire à distance** à étudier explicitement — source : entretien 17/07.

## À ne pas faire

- Ne pas transformer une intuition en vérité produit.
- Ne pas écrire "les propriétaires veulent" sans entrée terrain liée.
- Ne pas considérer une maquette comme validée parce qu'elle est jolie.
- Ne pas confondre préférence personnelle et usage réel.
- Ne pas transformer un litige entendu en feature : Ranti enregistre, il n'arbitre pas.
