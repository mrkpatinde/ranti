# Ranti — Welcome Flow

## Statut

Version 1.0 — approuvée pour Sprint 2.

Ce document décrit l'expérience d'accueil du propriétaire, depuis la première ouverture de Ranti jusqu'au tableau de bord vide.

Il ne décrit pas les écrans en détail. Il décrit le parcours, les décisions verrouillées et les critères de succès.

---

## Objectif

Un propriétaire doit pouvoir créer son espace Ranti et accéder à son tableau de bord vide en moins de 2 minutes.

Le propriétaire ne doit pas avoir l'impression de créer un compte administratif.

Il doit avoir l'impression d'entrer dans son cahier de loyers.

---

## Décisions verrouillées

### Pays

- L'inscription propose un choix de pays : Bénin (par défaut), Sénégal, Côte d'Ivoire.
- Au Sénégal et en Côte d'Ivoire, l'inscription se fait via Google uniquement pour le moment (voir ADR-008).

### Authentification

- L'identifiant principal est le téléphone (au Bénin ; email Google au Sénégal et en Côte d'Ivoire tant que l'OTP SMS n'y est pas disponible).
- Le mot de passe est obligatoire.
- L'OTP sert uniquement à vérifier le numéro lors de la première inscription.
- L'OTP pourra aussi servir plus tard pour la récupération de compte ou une action sensible.
- Il n'y a pas d'OTP à chaque connexion.
- L'authentification est gérée par Supabase Auth.
- Ranti ne stocke pas les mots de passe dans les tables métier.

### Propriétaire

- La table métier `landlords` est liée à `auth.users` par `auth_user_id`.
- Aucun propriétaire métier n'est créé automatiquement au moment brut de création du compte auth.
- Le propriétaire métier est créé seulement après vérification du téléphone et saisie du profil minimal.

### Profil minimal

Les seules informations demandées au démarrage sont :

- civilité ;
- prénom ;
- nom.

Aucun email, adresse, pays, devise ou document d'identité n'est demandé dans le MVP Welcome.

---

## Parcours — Nouveau propriétaire

1. Le propriétaire ouvre Ranti.
2. Il comprend immédiatement que Ranti sert à suivre ses loyers, les retards et les reçus.
3. Il choisit de commencer.
4. Il saisit son numéro de téléphone.
5. Il choisit un mot de passe.
6. Ranti vérifie son numéro une seule fois.
7. Il renseigne son profil minimal : civilité, prénom, nom.
8. Ranti crée son espace propriétaire.
9. Il arrive sur un tableau de bord vide.
10. Ranti lui propose une seule prochaine action : ajouter son premier bien.

---

## Parcours — Propriétaire existant

1. Le propriétaire ouvre Ranti.
2. Il saisit son numéro de téléphone.
3. Il saisit son mot de passe.
4. Ranti reconnaît son espace.
5. Il arrive directement sur son tableau de bord.

Aucune vérification OTP ne doit être demandée lors d'une connexion normale.

---

## Tableau de bord vide

Le tableau de bord vide ne doit jamais ressembler à une page vide.

Message attendu :

> Bienvenue, Adonis.
>
> Commençons par ajouter votre premier bien.

Action principale :

> Ajouter un bien

Aucune autre action ne doit concurrencer ce premier pas.

---

## Cas particuliers

### Numéro déjà connu

Si le numéro existe déjà, Ranti propose une connexion par téléphone et mot de passe.

### Mot de passe oublié

Le propriétaire peut demander une récupération de compte.

La récupération peut utiliser OTP, mais elle ne fait pas partie du flux normal de connexion.

### Profil incomplet

Si un utilisateur auth existe mais que le profil propriétaire n'est pas complet, Ranti reprend le parcours au profil minimal.

---

## Critères de succès

Le Sprint 2 est réussi si :

- un nouveau propriétaire peut créer son espace en moins de 2 minutes ;
- un propriétaire existant peut revenir sans OTP ;
- un propriétaire ne voit jamais les données d'un autre propriétaire ;
- le tableau de bord vide est clair et rassurant ;
- le propriétaire sait immédiatement quoi faire ensuite ;
- aucune information inutile n'est demandée avant le premier bien.

---

## Principe UX

Le propriétaire ne crée pas un compte.

Il entre chez lui.
