# Backlog — BulletRide

_Dernière mise à jour : 2026-08-03_

## En cours de traitement

Rien actuellement.

## À faire

### 1. Interaction & fonctionnalités

Issus de la veille (voir « Fait récemment »).

- **km par jour (optionnel)** : champ km dans la modale → stat « X km cette année ».
- **Vue mensuelle détaillée** : tap sur un mois → grand mois avec notes/km lisibles, en complément de la vue annuelle.
- **Icône/emoji par catégorie** : un emoji par catégorie, affiché dans la pastille.

### 2. Design

- **Logo** (à faire en premier) : créer un logo pour l'app.
- **Design global de la page** : refonte graphique, une fois le logo obtenu.
- **Vision mobile à travailler** : passer en revue et retravailler l'affichage sur mobile.

### 3. Infrastructure & données

- **Synchro des données** : pouvoir utiliser l'app sur mobile et sur PC avec les mêmes données (à l'image d'Omnivore). C'est aussi ce qui fera office de sauvegarde des sorties (aujourd'hui uniquement en `localStorage`, par appareil).

## Hors scope pour l'instant

- Objectif de sorties (année/mois avec barre de progression) : proposé, non retenu pour l'instant.
- Export / import JSON : proposé, non retenu pour l'instant (sera couvert par la synchro).
- Rappels / notifications PWA : à trancher plus tard (support iOS partiel).
- Météo auto du jour : nécessite réseau + API + géoloc, casse le côté 100 % local.
- Entretien moto (rappels vidange/pneus/chaîne) : plutôt un module à part.
- GPS auto / itinéraires sur carte, suivi carburant/MPG, aspect communautaire : en ferait une autre app.

## Fait récemment

- Déploiement GitHub Pages : repo public https://github.com/christophem59/BulletRide, app en ligne sur https://christophem59.github.io/BulletRide/. PWA installable + offline confirmée sur l'origine déployée (service worker actif, tous les assets servis, chemins relatifs OK sous le sous-dossier). Commits sur identité GitHub noreply (aucune info perso publiée) ; les données de sorties restent locales (jamais dans le repo).
- Stats enrichies : sous les compteurs total + par catégorie, un encart affiche « Meilleur mois » (mois avec le plus de sorties), « Jour préféré » (jour de semaine le plus fréquent) et un mini-graphe des sorties mois par mois (12 barres). Masqué tant qu'il n'y a aucune sortie sur l'année affichée.
- Note par jour : champ note optionnel dans la modale d'un jour (destination, avec qui, ressenti). Les jours annotés gardent la couleur de leur catégorie et portent une barre blanche en bas de la case ; une note peut exister sans catégorie (jour non « moto »), et vider note + catégorie supprime l'entrée. Modèle de données passé de `"<catId>"` à `{ cat, note, km }` avec migration automatique des anciennes données.
- Bouton « J'ai roulé aujourd'hui » : gros bouton sous le sélecteur d'année qui ouvre directement la modale du jour (bascule d'abord sur l'année courante si besoin).
- Veille fonctionnelle bullet journal : revue des apps bullet journal (Bujo, Bullet), habit trackers 2026 (Streaks, SingularityApp), Year in Pixels/Pixels et apps moto (TouringTrace, Ride Log, MotoVault). A alimenté le backlog « Interaction & fonctionnalités » (retenus : note par jour, bouton « J'ai roulé aujourd'hui », stats enrichies, km/jour, vue mensuelle détaillée, emoji par catégorie) et « Hors scope » (objectif, export JSON, rappels, météo auto, entretien, GPS/carburant/social).
- Choix de catégorie via modale : un clic sur une date ouvre une modale (titre = date en toutes lettres) listant les catégories colorées + « Aucune (pas de moto) ». La catégorie courante y est pré-sélectionnée ; choisir une option applique et ferme. Remplace l'ancien « tap pour changer » qui cyclait les couleurs. Fermeture par ✕, clic extérieur ou Échap ; jours futurs toujours non modifiables.
- v1 : bullet journal moto en PWA vanilla JS. Vue grille annuelle (12 mois d'un coup, une pastille par jour, semaine lundi→dimanche), coloriage par type de sortie (Balade / Trajet / Circuit / Off-road), tap qui cycle les couleurs, éditeur de catégories (nom + couleur, ajout/suppression), stats de l'année (total + par catégorie), navigation d'année, jours futurs non modifiables, aujourd'hui mis en évidence, installable + offline. Données stockées localement (localStorage).
