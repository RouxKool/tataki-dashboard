# Tataki — Dashboard Instagram

Dashboard interne pour suivre, semaine par semaine, à quel point l'équipe répond aux
commentaires reçus sur le compte Instagram Tataki — pensé pour l'équipe et les managers,
consultable en un clic, sans calcul à attendre.

## Ce qu'on y trouve

- **Taux de réponse** : % de commentaires (hors ceux laissés par Tataki lui-même) ayant reçu
  au moins une réponse de Tataki
- Nombre de commentaires répondus / total, nombre de posts publiés, nombre d'abonnés (+ évolution)
- **Vues totales des Reels**, **engagement total/moyen/médian** — engagement = likes +
  commentaires + partages + enregistrements (`total_interactions`, métrique officielle Instagram)
- Détail par post de la période sélectionnée : date, type (photo/carrousel/reel), extrait de
  légende (pour identifier le post sans dépendre d'une image — voir "Limites connues"), likes,
  commentaires, répondus, taux, partages, vues. Affiché par 5, avec un bouton "Afficher plus".
- Une barre chronologique pour naviguer semaine par semaine, ou basculer en vue mensuelle
- Un graphique d'évolution du taux de réponse dans le temps

**Non inclus** (limite de l'API Instagram) : impossible de savoir *quel* CM en particulier a
répondu à quoi — l'API ne distingue pas les personnes derrière le compte Tataki, seulement
"le compte a répondu ou non".

## Architecture

```
GitHub Actions (cron chaque lundi, + rattrapage manuel)
   → récupère les posts de la semaine passée + tous leurs commentaires/réponses
   → calcule le taux de réponse, l'engagement, un instantané du nombre d'abonnés
   → écrit/complète data/history.json (historique versionné dans le repo)
   → push déclenche la republication de GitHub Pages

GitHub Pages (site 100% statique)
   → sert index.html/app.js/style.css + data/history.json
   → tous les calculs sont déjà faits : ouverture instantanée, aucune attente
```

Contrairement à `tataki-commentaires` (calcul en direct à la demande), ce dashboard
pré-calcule tout à l'avance — donc pas de souci de limite Cloudflare, pas de serveur à gérer,
juste GitHub Pages (comme `insta-recherche`).

## Schéma des données (`data/history.json`)

Un objet par semaine :

```jsonc
{
  "weekStart": "2025-06-02",       // lundi
  "weekEnd": "2025-06-08",         // dimanche
  "posts": [
    {
      "id": "...", "permalink": "...", "timestamp": "...",
      "mediaType": "CAROUSEL_ALBUM", "mediaProductType": null, "captionPreview": "Enquête sur...",
      "likeCount": 3200, "commentsTotal": 42, "commentsAnswered": 30,
      "shares": 58, "totalInteractions": 3400, "plays": null   // plays non-null seulement pour les Reels
    }
  ],
  "followerCount": 271330
}
```

Il n'y a pas de champ `totals` pré-calculé : le taux de réponse, l'engagement (total/moyen/
médian) et les vues sont recalculés à la volée côté dashboard à partir de la liste `posts` —
une seule source de vérité, que ce soit pour une semaine ou un mois agrégé.

`data/followers-history.json` contient l'historique des instantanés d'abonnés (un par
semaine), utilisé pour remplir `followerCount` — importé une première fois depuis un stock
manuel, puis complété automatiquement chaque semaine.

## Mise en place (à faire une fois)

### 1. Créer le repo GitHub

```bash
cd /Users/alessandromauro/Claude/tataki-dashboard
git init
git add .
git commit -m "Initial commit"
```

Puis créer un repo **public** vide sur GitHub nommé `tataki-dashboard` (compte `RouxKool`), et :

```bash
git remote add origin https://github.com/RouxKool/tataki-dashboard.git
git branch -M main
git push -u origin main
```

### 2. Ajouter les secrets GitHub Actions

Repo → **Settings → Secrets and variables → Actions**, ajouter (les mêmes valeurs que pour
`insta-recherche`/`tataki-commentaires` — même compte Instagram Business) :

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`

### 3. Activer GitHub Pages

1. Repo → **Settings → Pages**.
2. **Source** : "Deploy from a branch".
3. **Branch** : `main`, dossier `/ (root)`.
4. **Save**.

L'URL du site apparaît en haut de cette page après quelques minutes.

### 4. Lancer le rattrapage de l'historique (une fois)

Repo → **Actions → Rattrapage de l'historique → Run workflow**. Laisse la date par défaut
(2025-01-06, premier lundi du stock d'abonnés fourni) sauf besoin différent.

⚠️ **Ça peut prendre longtemps** (le compte est très actif — beaucoup de posts/commentaires
par semaine sur plus d'un an et demi d'historique). Si l'API Instagram limite le nombre
d'appels et que le workflow échoue en cours de route, ce n'est pas grave : tout ce qui a déjà
été calculé est sauvegardé, il suffit de relancer le même workflow pour qu'il reprenne
automatiquement là où il s'était arrêté (il saute les semaines déjà faites).

Une fois terminé, le workflow **"Mise à jour hebdomadaire du dashboard"** prend le relais tout
seul chaque lundi (calcule la semaine qui vient de se terminer + un nouvel instantané
d'abonnés), sans plus rien à faire.

## Développement local

```bash
npx serve .
```

(nécessaire pour que `fetch("data/history.json")` fonctionne — ouvrir `index.html` directement
dans le navigateur ne marche pas).

Pour tester les scripts de calcul en local :

```bash
cp .env.example .env   # renseigner les 2 variables (voir étape 2 ci-dessus)
node --env-file=.env scripts/compute-week.js 2025-06-02
node --env-file=.env scripts/backfill.js 2025-01-06
```

## Fichiers clés

- `index.html` / `style.css` / `app.js` — le dashboard (tuiles, tableau, graphique, timeline)
- `scripts/lib/instagram.js` — client Instagram Graph API (posts, commentaires + réponses,
  nombre d'abonnés)
- `scripts/lib/weekly-stats.js` — calcule les statistiques d'une semaine donnée
- `scripts/lib/history-store.js` — lecture/écriture de `data/history.json` et
  `data/followers-history.json`
- `scripts/compute-week.js` — calcule et enregistre une semaine (la dernière complète par défaut)
- `scripts/backfill.js` — calcule tout l'historique depuis une date de départ, reprend
  automatiquement en cas d'interruption
- `scripts/record-follower-snapshot.js` — enregistre l'instantané abonnés de la semaine en cours
- `.github/workflows/update-weekly.yml` — mise à jour automatique chaque lundi
- `.github/workflows/backfill.yml` — rattrapage manuel de l'historique

## Limites connues

- Impossible d'attribuer une réponse à un CM en particulier (voir plus haut).
- Le nombre d'abonnés ne peut être suivi que depuis le moment où on commence à l'enregistrer
  (ou depuis un stock manuel importé) — pas de reconstruction rétroactive au-delà.
- **Pas de miniature/photo de prévisu** : les URLs d'images/vignettes Instagram expirent après
  ~24h, incompatibles avec un historique permanent. Un extrait de la légende identifie le post
  à la place (n'expire jamais).
- `total_interactions`/`shares`/`plays` nécessitent la permission `instagram_manage_insights`
  sur le token (déjà en place) ; si une métrique est indisponible pour un post donné, sa valeur
  reste à `null` sans faire échouer le reste du calcul.
- Le token Instagram expire après 60 jours (même token que les autres projets) : penser à le
  renouveler dans les 3 repos si besoin.
