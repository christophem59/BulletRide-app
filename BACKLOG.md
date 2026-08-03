# Backlog — BulletRide

_Dernière mise à jour : 2026-08-03_

## En cours de traitement

Rien actuellement.

## À faire

### 1. Interaction & fonctionnalités

Issus de la veille (voir « Fait récemment »).

- **Vue mensuelle détaillée** : tap sur un mois → grand mois avec notes/km lisibles, en complément de la vue annuelle.

### 2. Design

- **Logo** (à faire en premier) : créer un logo pour l'app.
- **Design global de la page** : refonte graphique, une fois le logo obtenu.
- **Vision mobile à travailler** : passer en revue et retravailler l'affichage sur mobile.

### 3. Infrastructure & données

Rien actuellement.

## Hors scope pour l'instant

- Objectif de sorties (année/mois avec barre de progression) : proposé, non retenu pour l'instant.
- Export / import JSON : proposé, non retenu pour l'instant (sera couvert par la synchro).
- Rappels / notifications PWA : à trancher plus tard (support iOS partiel).
- Météo auto du jour : nécessite réseau + API + géoloc, casse le côté 100 % local.
- Entretien moto (rappels vidange/pneus/chaîne) : plutôt un module à part.
- GPS auto / itinéraires sur carte, suivi carburant/MPG, aspect communautaire : en ferait une autre app.
- Icône/emoji par catégorie : maquette faite, écartée pour le moment (ne convainc pas visuellement).
- Intégration app 68° (GPS moto) : étudiée, abandonnée. 68° est un planificateur/GPS, il n'enregistre pas les sorties effectuées (pas de temps de roulage ni km réels) et n'a pas d'API publique → rien à récupérer. BulletRide étant une PWA statique sans backend, la seule intégration possible aurait été un simple lien « ouvrir 68° » (aucune donnée en retour), jugé trop peu utile. Pour récupérer km/durée automatiquement il faudrait plutôt une app de tracking (Detecht/REVER/Calimoto) via import GPX horodaté — piste app-agnostique si le besoin revient.

## Fait récemment

- km + temps de route par jour : deux champs (distance en km, temps en h/min) dans la modale d'un jour, avec totaux annuels dans les stats (« X km », « X h de route »). Valeurs par défaut par catégorie (défauts km/temps dans l'éditeur 🎨) : choisir la catégorie pré-remplit les champs du jour s'ils sont vides (jamais d'écrasement d'une saisie) — pensé pour le trajet travail toujours identique. Modèle de jour : `{ cat, note, km, min, u }` ; catégorie : `{ id, label, color, defKm, defMin }`. Synchronisés comme le reste.
- Synchro des données (GitHub) : le `localStorage` reste la copie de travail (offline-first) et un fichier privé `bulletride.json` dans un repo GitHub choisi sert de sauvegarde + synchro multi-appareils, via l'API Contents avec un PAT stocké uniquement sur l'appareil (pattern Omnivore). Pull+fusion au chargement, push débounced à chaque modif, resynchro au retour en ligne. Fusion sans perte jour par jour : horodatage `u` par jour + tombstones pour les suppressions (le plus récent gagne) ; catégories en dernier-écrit-gagne via `catsU` ; retry auto sur conflit 409/422. Modale ☁️ pour connecter le repo/token (repo privé dédié — le repo de code BulletRide-app étant public). Logique de fusion couverte par des tests unitaires ; round-trip GitHub réel à valider avec un vrai repo privé + PAT.
- Déploiement GitHub Pages : repo public https://github.com/christophem59/BulletRide-app, app en ligne sur https://christophem59.github.io/BulletRide-app/. PWA installable + offline confirmée sur l'origine déployée (service worker actif, tous les assets servis, chemins relatifs OK sous le sous-dossier). Commits sur identité GitHub noreply (aucune info perso publiée) ; les données de sorties restent locales (jamais dans le repo).
- Stats enrichies : sous les compteurs total + par catégorie, un encart affiche « Meilleur mois » (mois avec le plus de sorties), « Jour préféré » (jour de semaine le plus fréquent) et un mini-graphe des sorties mois par mois (12 barres). Masqué tant qu'il n'y a aucune sortie sur l'année affichée.
- Note par jour : champ note optionnel dans la modale d'un jour (destination, avec qui, ressenti). Les jours annotés gardent la couleur de leur catégorie et portent une barre blanche en bas de la case ; une note peut exister sans catégorie (jour non « moto »), et vider note + catégorie supprime l'entrée. Modèle de données passé de `"<catId>"` à `{ cat, note, km }` avec migration automatique des anciennes données.
- Bouton « J'ai roulé aujourd'hui » : gros bouton sous le sélecteur d'année qui ouvre directement la modale du jour (bascule d'abord sur l'année courante si besoin).
- Veille fonctionnelle bullet journal : revue des apps bullet journal (Bujo, Bullet), habit trackers 2026 (Streaks, SingularityApp), Year in Pixels/Pixels et apps moto (TouringTrace, Ride Log, MotoVault). A alimenté le backlog « Interaction & fonctionnalités » (retenus : note par jour, bouton « J'ai roulé aujourd'hui », stats enrichies, km/jour, vue mensuelle détaillée, emoji par catégorie) et « Hors scope » (objectif, export JSON, rappels, météo auto, entretien, GPS/carburant/social).
- Choix de catégorie via modale : un clic sur une date ouvre une modale (titre = date en toutes lettres) listant les catégories colorées + « Aucune (pas de moto) ». La catégorie courante y est pré-sélectionnée ; choisir une option applique et ferme. Remplace l'ancien « tap pour changer » qui cyclait les couleurs. Fermeture par ✕, clic extérieur ou Échap ; jours futurs toujours non modifiables.
- v1 : bullet journal moto en PWA vanilla JS. Vue grille annuelle (12 mois d'un coup, une pastille par jour, semaine lundi→dimanche), coloriage par type de sortie (Balade / Trajet / Circuit / Off-road), tap qui cycle les couleurs, éditeur de catégories (nom + couleur, ajout/suppression), stats de l'année (total + par catégorie), navigation d'année, jours futurs non modifiables, aujourd'hui mis en évidence, installable + offline. Données stockées localement (localStorage).
