# Backlog — BulletRide

_Dernière mise à jour : 2026-08-03_

## En cours de traitement

Rien actuellement.

## À faire

### 1. Interaction & fonctionnalités

- **Veille fonctionnelle bullet journal** : rechercher les fonctionnalités proposées par les apps de bullet journal en général, pour décider ce qu'on veut intégrer à BulletRide.

### 2. Design

- **Logo** (à faire en premier) : créer un logo pour l'app.
- **Design global de la page** : refonte graphique, une fois le logo obtenu.
- **Vision mobile à travailler** : passer en revue et retravailler l'affichage sur mobile.

### 3. Infrastructure & données

- **Déploiement via repo Git** : créer le repo GitHub + mise en ligne (ex. GitHub Pages).
- **Synchro des données** : pouvoir utiliser l'app sur mobile et sur PC avec les mêmes données (à l'image d'Omnivore).

## Hors scope pour l'instant

Rien pour l'instant.

## Fait récemment

- Choix de catégorie via modale : un clic sur une date ouvre une modale (titre = date en toutes lettres) listant les catégories colorées + « Aucune (pas de moto) ». La catégorie courante y est pré-sélectionnée ; choisir une option applique et ferme. Remplace l'ancien « tap pour changer » qui cyclait les couleurs. Fermeture par ✕, clic extérieur ou Échap ; jours futurs toujours non modifiables.
- v1 : bullet journal moto en PWA vanilla JS. Vue grille annuelle (12 mois d'un coup, une pastille par jour, semaine lundi→dimanche), coloriage par type de sortie (Balade / Trajet / Circuit / Off-road), tap qui cycle les couleurs, éditeur de catégories (nom + couleur, ajout/suppression), stats de l'année (total + par catégorie), navigation d'année, jours futurs non modifiables, aujourd'hui mis en évidence, installable + offline. Données stockées localement (localStorage).
