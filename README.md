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

Cliquez sur une image pour l'agrandir.

<table>
  <tr>
    <td align="center"><a href="docs/acceuil.PNG"><img src="docs/acceuil.PNG" width="260" alt="Page d'accueil"></a><br><sub>Accueil</sub></td>
    <td align="center"><a href="docs/body-map.PNG"><img src="docs/body-map.PNG" width="260" alt="Carte du corps interactive"></a><br><sub>Carte du corps</sub></td>
    <td align="center"><a href="docs/profil-medecin.PNG"><img src="docs/profil-medecin.PNG" width="260" alt="Profil médecin et réservation"></a><br><sub>Profil médecin</sub></td>
  </tr>
  <tr>
    <td align="center"><a href="docs/medecin-login.PNG"><img src="docs/medecin-login.PNG" width="260" alt="Connexion médecin"></a><br><sub>Espace médecin</sub></td>
    <td align="center"><a href="docs/patient-login.PNG"><img src="docs/patient-login.PNG" width="260" alt="Connexion patient"></a><br><sub>Espace patient</sub></td>
  </tr>
</table>

## Choix du framework

**Angular 22** pour le frontend : application fluide sans rechargement, composants réutilisables, formulaires et navigation intégrés, TypeScript. Le backend est en **Node.js + Express** avec **PostgreSQL**.

## Fonctionnalités

### Visiteur
- **Accueil** : carte du corps interactive, recherche par spécialité / gouvernorat / nom, accès rapides (orientation, assistant, pharmacie de nuit, urgences), toutes les spécialités et les praticiens les mieux notés
- **Annuaire** : 21 spécialités, filtres (spécialité, gouvernorat, CNAM, téléconsultation), tri par note, tarif, expérience ou **proximité (« Près de moi »)**
- **Profil médecin** : photo, tarif, langues, CNAM, actes et formation, **carte de localisation du cabinet**, itinéraire, créneaux libres et **avis vérifiés** (note moyenne, répartition, réponse du praticien)
- **Orientation guidée** (`/orientation`) : quelques questions pour savoir s'il faut appeler le SAMU, aller aux urgences, consulter aujourd'hui, prendre rendez-vous ou demander conseil au pharmacien — et quel spécialiste consulter
- **Assistant santé** (`/assistant`) : l'utilisateur décrit ses symptômes avec ses mots (français, arabe ou derja) ; l'assistant pose les questions utiles puis donne des conseils ou oriente vers un médecin
- **Lieux de soins** (`/lieux-de-sante`) : pharmacies, **pharmacies de nuit**, urgences et hôpitaux, cliniques, laboratoires, radiologie et centres de santé **autour de moi** (géolocalisation) ou d'une ville, sur carte et triés par distance
- **Guide santé** (`/guide`) : 32 fiches (symptômes, gestes utiles, quand consulter, prévention)
- **Aide & contact** (`/aide`) : FAQ, numéros d'urgence, formulaire de contact
- **Confidentialité** (`/confidentialite`) : politique complète (loi organique n° 2004-63, INPDP)
- **Actualités santé** (flux RSS de l'OMS) et site **bilingue** français / arabe

### Patient
- Compte, réservation, suivi et annulation des rendez-vous
- **Carte santé** : groupe sanguin, allergies, antécédents, traitements, vaccins, contacts d'urgence, CNAM
  - partage facultatif avec les médecins chez qui le patient a un rendez-vous
  - **fiche d'urgence** par lien secret et QR code (données minimales, révocable)
  - historique de qui a consulté la carte
- **Avis** sur un praticien consulté via SehhaTN
- **Télécharger mes données** et **supprimer mon compte**

### Médecin
- Fiche professionnelle (position calculée à partir de l'adresse), horaires, rendez-vous
- Consultation de la carte santé des patients qui l'ont partagée, réponse aux avis

### Méthode d'orientation
Le même moteur (`backend/lib/triage.js`) sert l'orientation guidée et l'assistant. Il suit une échelle de 6 niveaux de soins : soins à domicile → pharmacien → consultation sous quelques jours → consulter aujourd'hui → urgences → SAMU 190.
1. **Signes d'alerte d'abord** : un seul signe vital (douleur thoracique oppressante, signes d'AVC, détresse respiratoire, idées suicidaires…) mène directement au 190 ou aux urgences.
2. **Niveau de départ** : celui du symptôme le plus sérieux (base de connaissances : 50 symptômes, 30 signes d'alerte, 32 affections).
3. **Modulateurs** : intensité, durée, nourrisson, personne âgée, grossesse. Sans signe d'alerte, on ne dépasse jamais « consulter aujourd'hui ».
4. **Spécialité** : celle du symptôme principal, ajustée (enfant → pédiatre, grossesse → gynécologue, plusieurs systèmes → généraliste), avec des praticiens proposés.
5. **Pistes** : affections partageant le plus de symptômes, présentées comme des sujets à évoquer avec un médecin, jamais comme un diagnostic.

Aucune donnée n'est envoyée à un service d'IA ; les réponses sont déterministes et couvertes par des tests.

### Sécurité
- **Aucune double réservation** possible, garantie par la base de données
- **Mots de passe chiffrés**, sessions par jeton, accès limité selon le rôle
- En-têtes de sécurité (helmet), **CORS en liste blanche**, **limitation de débit** (connexion, contact, assistant), validation stricte de toutes les entrées
- **Vie privée** : les patients ne voient jamais l'identité des autres ; les avis affichent un nom abrégé ; chaque accès à une carte santé est journalisé

Les lieux de soins combinent l'annuaire SehhaTN et les données ouvertes d'OpenStreetMap (Overpass / Nominatim, appelés par le serveur avec cache et repli). La position de l'utilisateur n'est demandée que sur action de sa part et n'est pas enregistrée.

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
cd SehhaTN
npm install               # installe frontend et backend depuis la racine
copy backend/.env.example backend/.env   # Windows PowerShell
```

Renseigner dans `backend/.env` :

```env
DATABASE_URL=postgresql://utilisateur:motdepasse@hote:5432/sehhatn
JWT_SECRET=une-longue-phrase-aleatoire
# Facultatif : flux RSS de l'accueil, séparés par des virgules
# NEWS_FEEDS=https://exemple.org/flux.xml
```

Créer les tables, remplir la base et lancer l’API (dans un premier terminal, après avoir configuré `backend/.env`) :

```bash
npm run db:seed          # schéma + spécialités + base de connaissances + données de démonstration
npm run start:backend
```

`npm run db:seed` est idempotent (on peut le relancer). Variantes, depuis `backend/` :

| Commande | Effet |
|---|---|
| `npm run db:seed:prod` | schéma + référentiels, **sans** données de démonstration |
| `npm run db:remove-demo` | supprime toutes les données de démonstration |
| `npm test` | tests du moteur d'orientation et de l'API (base de données requise) |

**Données de démonstration** : 99 praticiens fictifs (21 spécialités, 24 gouvernorats), environ 600 avis, 400 lieux de soins, avec photos. Elles sont marquées `is_demo` et signalées « Démo » sur le site. Sur un site utilisé par de vrais patients, définir `HIDE_DEMO_DATA=true` (ou lancer `db:remove-demo`). Pour créer les comptes de démonstration `patient@demo.sehhatn.tn` et `medecin@demo.sehhatn.tn`, définir `SEED_DEMO_PASSWORD` avant le seed.

Dans un second terminal, toujours à la racine, lancer le site Angular :

```bash
npm start
```

### Utilisation

1. Ouvrir http://localhost:4200 (le site utilise alors l'API locale sur le port 3000).
2. Créer un compte **médecin**, compléter la fiche et définir les horaires.
3. Créer un compte **patient**, ouvrir le profil du médecin et réserver un créneau.

Le badge « profil vérifié » s'active en passant `verified` à `true` dans la table `doctors`.

## Feuille de route

- Messagerie entre patient et médecin
- Espace administrateur (validation des médecins, modération des avis, messages de contact)
- Rappels de rendez-vous par e-mail ou SMS, réinitialisation du mot de passe par e-mail
- Pharmacies de garde à jour (calendrier officiel des gardes)
- Ordonnances et comptes rendus dans la carte santé, téléconsultation vidéo
- Option : reformulation des réponses de l'assistant par un modèle d'IA, après les règles de sécurité

## Contribuer

1. Forker le dépôt
2. Créer une branche : `git checkout -b ma-fonctionnalite`
3. Commiter et pousser vos changements
4. Ouvrir une Pull Request

## Licence

À définir.
