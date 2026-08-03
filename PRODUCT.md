# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

L'équipe social media de Tataki (community managers) et leurs managers. Consultation
**solo/ponctuelle** — chacun regarde le dashboard de son côté quand il en a besoin, ce n'est pas
un support utilisé pendant une réunion d'équipe récurrente.

## Product Purpose

Donner aux managers une visibilité claire, sans calcul manuel, sur la réactivité de l'équipe
face à la communauté Instagram : quelle proportion des commentaires reçus obtient une réponse
de Tataki, semaine par semaine, avec les métriques d'engagement et de croissance associées.

## Positioning

Instagram natif n'expose pas de métrique de "taux de réponse aux commentaires" — c'est un calcul
propre à Tataki, construit à partir des commentaires et réponses réels. Contrairement à un export
ou calcul à la demande (voir `tataki-commentaires`, projet frère), tout est pré-calculé une fois
par semaine par une automatisation : le dashboard s'ouvre instantanément, sans jamais attendre un
calcul en direct.

## Operating Context

- Mise à jour automatique chaque lundi (GitHub Actions), + rattrapage manuel de l'historique.
- Historique démarré au 2025-01-06 (première semaine du stock d'abonnés fourni par l'utilisateur) ;
  possibilité d'étendre plus tôt plus tard si besoin.
- Hébergé sur GitHub Pages (site 100% statique) — aucune authentification, lien ouvert (décision
  assumée : ce sont des statistiques d'équipe agrégées, pas des données individuelles sensibles).
- Fait partie d'une famille de 3 outils internes Tataki : `insta-recherche` (recherche de
  contenus), `tataki-commentaires` (export à la demande), `tataki-dashboard` (ce projet, suivi
  hebdomadaire).

## Capabilities and Constraints

- **Impossible d'attribuer une réponse à un CM en particulier** — limite de l'API Instagram (le
  compte ne distingue pas les personnes qui l'opèrent). Le dashboard mesure la réactivité de
  l'équipe dans son ensemble, jamais une performance individuelle.
- **Pas de miniature/photo de post** — les URLs d'images Instagram expirent après ~24h,
  incompatibles avec un historique permanent. Un extrait de légende identifie le post à la place.
- **Engagement** = `total_interactions` officiel Instagram (likes + commentaires + partages +
  enregistrements), pas une formule maison. Vues = métrique `plays`, disponible pour les Reels
  uniquement.
- **Pas de seuil "bon/mauvais" défini pour le taux de réponse** à ce stade — pas d'indicateur
  visuel bon/moyen/faible pour l'instant ; l'équipe découvre encore ses propres chiffres.
- Le nombre d'abonnés n'est traçable que depuis le moment où il est enregistré (stock manuel
  importé + instantané automatique chaque semaine) — pas de reconstruction rétroactive au-delà.

## Brand Commitments

Nom : **Tataki**. Thème visuel sombre partagé avec les deux autres outils internes de la même
famille (`insta-recherche`, `tataki-commentaires`) : fond quasi noir, accent rouge `#e8483a` —
à conserver pour la cohérence entre les trois outils.

## Evidence on Hand

- Historique réel du nombre d'abonnés depuis le 2025-01-06 (instantanés hebdomadaires fournis par
  l'utilisateur), importé dans `data/followers-history.json`.
- Le calcul du taux de réponse et de l'engagement a été testé en direct sur l'API Instagram réelle
  (ex: une semaine réelle a montré 19 posts / 1922 commentaires) — le mécanisme est validé, mais
  `data/history.json` est actuellement vide (`[]`) en attendant que le rattrapage tourne sur le
  vrai compte. Aucune donnée de démonstration ne doit être confondue avec une donnée réelle.

## Product Principles

1. Toujours afficher des données déjà calculées — ne jamais faire attendre un calcul en direct.
2. Responsabilité au niveau de l'équipe uniquement, jamais individuelle (contrainte de l'API, pas
   un choix à assouplir plus tard).
3. Toute donnée stockée doit rester valide indéfiniment (pas d'URLs/liens éphémères dans
   l'historique permanent).
4. Préférer les définitions de métriques officielles Instagram (`total_interactions`) à des
   formules maison, pour la crédibilité auprès des managers.
5. Optimiser pour une consultation solo et instantanée — pas besoin d'une réunion ou d'un guide
   pour comprendre les chiffres en un coup d'œil.
