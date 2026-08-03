# 🏍️ BulletRide

Bullet journal pour tracker chaque jour où tu as fait de la moto.

**En ligne :** https://christophem59.github.io/BulletRide-app/ (installable en PWA, fonctionne hors-ligne)

Vue **grille annuelle** (toute l'année d'un coup, une pastille par jour), colorée
par **type de sortie**. Un tap sur un jour passe à la catégorie suivante.

## Utilisation

- **Tap sur un jour** → cycle entre les couleurs : Balade → Trajet → Circuit → Off-road → (vide).
- **🎨 en haut à droite** → personnaliser les catégories (nom + couleur, ajout/suppression).
- **‹ / ›** → changer d'année.
- Les stats en haut résument l'année (total + détail par catégorie).
- Les jours futurs ne sont pas modifiables.

## Technique

PWA en **vanilla JS** (aucun build). Données stockées **localement** sur
l'appareil (`localStorage`), rien n'est envoyé sur le réseau. Installable
(manifest + service worker, fonctionne hors-ligne).

Fichiers :

| Fichier | Rôle |
|---|---|
| `index.html` | structure |
| `styles.css` | thème sombre + grille |
| `app.js` | logique (rendu, cycle des jours, catégories, stats) |
| `manifest.json` / `sw.js` | PWA installable + offline |
| `icon-192.png` / `icon-512.png` | icônes |

## Lancer en local

```bash
python3 -m http.server 4599
```

Puis ouvrir http://localhost:4599

## À faire plus tard

- Synchro des données mobile/PC + sauvegarde (à l'image d'Omnivore).

Voir [BACKLOG.md](BACKLOG.md) pour le détail.
