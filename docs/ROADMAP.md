# Feuille de route

Ce qui a été livré, lot par lot, et ce qui reste ouvert. Le détail technique est dans le
[README](../README.md), le déploiement dans [DEPLOY.md](DEPLOY.md) et l'analyse de l'article
dans [seo/ANALYSE.md](seo/ANALYSE.md).

## Livré

| Lot | Contenu | PR |
| --- | --- | --- |
| V1 | Lecture et validation des 18 CSV, les 7 points du sujet, CI et image Docker, Bun épinglé | #1 à #6 |
| Logique métier | Économies, offres imbattables, contrôles (doublons, prix atypiques, incohérences), simulateur de voyage, histogramme, rapport d'import sur chaque PR de données | #7 |
| Données sans rebuild | Service d'ingestion : API avec jeton, dossier `inbox/`, CLI, releases atomiques, garde-fou, webhook, limitation des essais | #8 |
| Interface | DA MyBestSim, mise en page large, sous-pages, filtres dans l'URL, export CSV, page `/import`, données en direct, thème sombre | #9 |
| CI | Tests navigateur dans l'image Playwright, smoke test des conteneurs, CI ignorée pour les données et la doc, Dependabot | #10, #14 |
| Documentation | README, déploiement, feuille de route | #11 |
| Dépôt propre | Nouveau dépôt privé, historique rejoué en PR, oracles versionnés dans `checks/` | #16, #17 |
| Mise en ligne | Site sur le VPS, `deploy/` identique au VPS, job `verify` actif | #19 |
| Partie 2 | Analyse de 12 pages concurrentes, article « Internet en croisière : quelle eSIM choisir ? », mise en page pleine largeur | #21, #23, #24 |
| Bac à sable | Publication sans jeton depuis `/import`, vue `?bac=1`, remise à zéro chaque nuit | #22 |
| Entretien | Arrêt propre du serveur e2e, `CLAUDE.md` dans le vault, mises à jour des actions GitHub et d'axe-core, accessibilité de `/import`, captures | #18, #20, #12, #25, #26, #27 |
| Lighthouse | Polices préchargées, plus de redirection, page 404, article indexable avec sitemap, accessibilité et CSP corrigées | #28 |
| PageSpeed | Toutes les pages indexables, repère `<main>`, données de l'îlot réduites de 480 à 50 Ko, catalogue en direct calculé dans un Web Worker, hydratation après le premier affichage, CSS intégrée, oracle SEO, puis le sommaire de l'article qui forçait une mise en page avant l'affichage, et un oracle PageSpeed après déploiement | #29, #30 |

## Ouvert

Par ordre d'intérêt pour MyBestSim.

1. **Publier l'article sur mybestsim.com.** Il est prêt à l'emploi : titres, données
   structurées, liens internes, suggestions d'images. Le jour de sa publication, ajouter ici une
   canonical vers sa nouvelle URL, pour éviter le contenu dupliqué.
2. **De vraies images dans l'article**, à partir des suggestions (photo d'escale, carte des
   itinéraires, capture des réglages d'un iPhone), en WebP et avec leur texte alternatif.
3. **Surveillance** : `bun run checks:live` une fois par jour (tâche planifiée GitHub, environ
   1 minute de CI par jour) et un `WEBHOOK_URL` Discord ou Slack pour être prévenu de chaque import.
4. **Comparateur côte à côte** de deux fournisseurs.
5. **`catalog.json` plus compact.** Il pèse 1 Mo brut et 94 Ko compressé. Mesuré en ligne le
   27 octobre 2026, le contenu principal s'affiche en 0,3 à 0,5 s : ce n'est pas prioritaire.
6. **Budget de performance en CI** (Lighthouse CI). L'accessibilité est déjà couverte par axe dans
   la suite e2e.
7. **Un déploiement de prévisualisation par PR**, sur un sous-domaine éphémère.
