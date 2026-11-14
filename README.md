# SehhaTN

![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Hosting](https://img.shields.io/badge/Hosting-GitHub%20Pages%20%2B%20Render-0B325E)

Annuaire médical tunisien avec prise de rendez-vous en ligne. Les patients trouvent un médecin par spécialité, région ou zone du corps, puis réservent un créneau. Les médecins publient leur fiche et gèrent leurs horaires.

## Site en ligne

Voici le lien du site : **https://dhiaaelh.github.io/SehhaTN/**

Il est fonctionnel. Vous pouvez dès maintenant vous connecter en tant que **médecin** ou **patient** et prendre un rendez-vous. Le serveur (Render) et la base de données (Neon) sont déjà en ligne.

> Le serveur est sur l'offre gratuite de Render : la première requête après une période d'inactivité peut prendre jusqu'à une minute.

## Aperçu

### Accueil
![Page d'accueil](docs/accueil.PNG)

### Carte du corps
![Carte du corps interactive](docs/body-map.PNG)

### Espace médecin
![Connexion médecin](docs/medecin-login.PNG)

### Espace patient
![Connexion patient](docs/patient-login.PNG)

### Profil médecin
![Profil médecin et réservation](docs/profil-medecin.PNG)

## Choix du framework

**Angular 22** pour le frontend : application fluide sans rechargement, composants réutilisables, formulaires et navigation intégrés, TypeScript. Le backend est en **Node.js + Express** avec **PostgreSQL**.

## Fonctionnalités

### Visiteur
- **Accueil** : carte du corps interactive (face et dos) qui oriente vers les bonnes spécialités, recherche par spécialité, gouvernorat et nom
- **Actualités santé** : articles récents de flux RSS officiels (OMS), mis en cache côté serveur
- **Annuaire** : médecins réels inscrits sur le site, avec filtres
- **Profil médecin** : page dédiée avec tarif, langues, CNAM, adresse, badge de profil vérifié et créneaux libres
- **Guide santé** et **orientation en 3 étapes** (contenu statique pour l'instant)
- **Bilingue** français et arabe (affichage de droite à gauche), adapté au mobile

### Patient
- **Compte** : inscription et connexion
- **Réservation** : choix d'un jour et d'un créneau libre, note facultative
- **Mes rendez-vous** : suivi des statuts et annulation

### Médecin
- **Fiche professionnelle** : création et modification, visible dans l'annuaire
- **Horaires** : plages par jour et durée de consultation (15 à 60 minutes)
- **Rendez-vous** : consultation, annulation, marquage terminé ou absent

### Règles de réservation
- Heure de Tunis, au moins 2 h à l'avance et jusqu'à 30 jours
- Un seul rendez-vous à venir par patient et par médecin
- Annulation possible jusqu'au début du rendez-vous

### Sécurité
- **Aucune double réservation** possible, garantie par la base de données
- **Mots de passe chiffrés**, sessions par jeton et accès limité selon le rôle (patient, médecin, admin)
- **Vie privée** : les patients ne voient jamais l'identité des autres

## Architecture

| Élément | Service |
|---|---|
| Frontend | GitHub Pages (déploiement automatique) |
| Backend (API) | Render |
| Base de données | Neon (PostgreSQL) |

```
SehhaTN/
├── frontend/   site Angular
├── backend/    API Express, routes, schéma SQL
├── docs/       images du README
└── .github/    déploiement automatique
```

## Démarrage

### Prérequis
- Node.js 22 ou plus
- Une base PostgreSQL (locale ou Neon)

### Installation

```bash
git clone https://github.com/DhiaaELH/SehhaTN.git
cd SehhaTN/backend
npm install
cp .env.example .env     # Windows : copy .env.example .env
```

Renseigner dans `backend/.env` :

```env
DATABASE_URL=postgresql://utilisateur:motdepasse@hote:5432/sehhatn
JWT_SECRET=une-longue-phrase-aleatoire
# Facultatif : flux RSS de l'accueil, séparés par des virgules
# NEWS_FEEDS=https://exemple.org/flux.xml
```

Créer les tables et lancer le serveur :

```bash
npm run db:init
npm run dev
```

Dans un second terminal, lancer le site :

```bash
cd frontend
npm install
npm start
```

### Utilisation

1. Ouvrir http://localhost:4200 (le site utilise alors l'API locale sur le port 3000).
2. Créer un compte **médecin**, compléter la fiche et définir les horaires.
3. Créer un compte **patient**, ouvrir le profil du médecin et réserver un créneau.

Le badge « profil vérifié » s'active en passant `verified` à `true` dans la table `doctors`.

## Feuille de route

- Avis des patients avec modération et réponse du médecin
- Messagerie entre patient et médecin
- Assistant d'orientation par IA (bloc « Consultation rapide »)
- Espace administrateur pour valider les médecins
- Rappels de rendez-vous par e-mail ou SMS

## Contribuer

1. Forker le dépôt
2. Créer une branche : `git checkout -b ma-fonctionnalite`
3. Commiter et pousser vos changements
4. Ouvrir une Pull Request

## Licence

À définir.
