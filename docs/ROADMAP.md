# Feuille de route

Idées notées pendant la V1, classées par impact. La V1 couvre le brief à la lettre. Le but
ici : impressionner sans perdre en lisibilité.

## Fait en v2 (branche `feat/v2-comparator`)

Corrections de la revue du 26/10/2026 :

- débordement horizontal sur mobile corrigé (`min-w-0` sur les cartes de grille) ; un test e2e le
  vérifie à 360, 390, 768, 1 024 et 1 440 px, et un contrôle négatif prouve qu'il échoue sur
  l'ancienne mise en page (172 et 202 px de débordement) ;
- filtres repliables sur mobile, avec compteur : les KPI sont visibles dès le premier écran ;
- plus aucune donnée accessible seulement au survol (parts et effectifs affichés en clair) ;
- bloc « À retenir » généré depuis les données (il suit les filtres) ;
- contraste du gris secondaire remonté au niveau AA (repéré par axe) ;
- chemins du ledger part1 rendus portables, Bun épinglé en 1.4.4 partout.

Nouveautés :

- **Économies** : forfaits identiques, écart de prix, fournisseur le moins cher le plus souvent,
  offres imbattables (axe 3) ;
- **Contrôles métier** : doublons de SKU, prix atypiques, offres incohérentes dans la gamme d'un
  fournisseur (axe 4) ;
- **Simulateur de voyage** avec forfaits régionaux et estimation de la data (axe 8) ;
- **Histogramme des prix** avec médiane et moyenne (axe 9) ;
- **Page `/import`** : glisser-déposer d'un CSV, rejets, diff et anomalies dans le navigateur
  (axe 5) ;
- **Rapport d'import sur chaque PR de données** (axes 1 et 2 : le diff entre deux imports est
  calculé par la CI à partir du commit de base) ;
- **Filtres dans l'URL**, bouton « Copier le lien », **export CSV** au format fournisseur (axe 6) ;
- **Thème clair / sombre / système** ;
- **Tests e2e Playwright + axe en CI** (axes 10 et 11, axe remplace Lighthouse pour l'accessibilité) ;
- **Dependabot** (axe 12).

Restent ouverts : comparateur côte à côte (7), `catalog.json` compact (13, 77 Ko gzip : pas
prioritaire), prévisualisation par PR (14), et toute la partie présentation (15 à 17).

## Fait en v3 et v4

- **DA MyBestSim** : Poppins, bleu `#007bff`, pastilles, cartes arrondies, CTA rouge ; clair par
  défaut, sombre bleu nuit en option ; largeur jusqu'à 1 720 px.
- **Données hors du build** (`docs/DEPLOY.md`) : service d'ingestion Bun (API avec jeton,
  dossier `inbox/`), releases atomiques avec historique, garde-fou sur les variations
  anormales, webhook ; le dashboard lit les données en direct et affiche « Depuis le dernier
  import » ; bouton « Publier » sur `/import` ; la CI ignore les changements de données.

En v5 : accueil allégé et sous-pages (`/analyse`, `/offres`, `/qualite`), filtres conservés
d'une page à l'autre, curseur main sur tous les contrôles, README complet avec captures. Repris
de la PR #6 : jeton de 24 caractères minimum, limitation des essais, imports « inchangés », CLI
`bun run import`, smoke test des conteneurs en CI, healthchecks.

Reste à faire : le **bac à sable public** pour que le recruteur publie sans jeton (jeu
`sandbox` remis à zéro chaque nuit), puis le déploiement.

## Ordre recommandé

1. Déployer la V1 telle quelle, pour avoir un lien en ligne en sécurité.
2. Écrire l'article SEO (partie 2) : c'est la moitié du test.
3. Développer les axes 1 à 5 ci-dessous et faire la refonte frontend responsive.
4. Finir par le README, les captures, le Loom et le texte du mail.

## Densité d'information

Le dashboard montre peut-être trop de choses. Un recruteur doit voir les 6 stats demandées en
5 secondes.

- **Au-dessus de la ligne de flottaison** : les points 1 à 6 du brief, avec leur numérotation pour
  qu'on puisse les cocher, plus 2 ou 3 insights forts. Rien d'autre.
- **Le reste dans des onglets ou des sections repliables** :
  - « Analyse » : les bonus (point 7) ;
  - « Catalogue » : le tableau des offres ;
  - « Méthode » : les choix assumés et la qualité des données.
- Réduire le tableau « meilleures offres » à 5 lignes, avec un bouton « voir plus ».

## Refonte frontend : responsive partout

- Mobile d'abord. Tester à trois largeurs minimum : 360, 768 et 1 440 px. Aucun scroll horizontal
  de page.
- Sur mobile, le tableau devient une liste de cartes et les filtres passent dans un panneau
  (drawer) à ouvrir, avec un compteur de filtres actifs.
- Bascule clair/sombre manuelle en plus de `prefers-color-scheme`.
- Audit d'accessibilité : clavier, lecteur d'écran, contrastes. Viser Lighthouse 100 et afficher
  le score dans le README.

## Ajouter des CSV

Le processus actuel :

1. Déposer `<fournisseur>.csv` dans `data/`, avec les 12 mêmes colonnes.
2. Lancer `bun run validate` en local. Il liste les lignes rejetées, avec fichier, ligne et
   raison.
3. Créer une branche `chore/data-<fournisseur>`, puis ouvrir une PR. La CI valide le schéma et
   bloque les données invalides.
4. Merger. L'image est publiée, Watchtower déploie en 1 minute environ, et le job `verify`
   confirme le sha en ligne.

Sans outil de dev, c'est possible depuis GitHub : « Add file », puis « Upload » dans `data/`,
puis ouvrir la PR. La CI fait le reste.

## Axes d'amélioration, par impact

### Collés au métier

MyBestSim est un comparateur qui importe des données chaque jour.

1. **Changements depuis le dernier import** : nouvelles offres, offres retirées et prix modifiés,
   par fournisseur. Répond directement à « on importe chaque jour ». Effort moyen.
2. **Résumé automatique sur chaque PR de données** : la CI poste un commentaire du type « +12
   offres, 3 baisses de prix, 0 rejet ». C'est une revue de données automatisée. Effort moyen.
3. **Économies possibles** : pour un même forfait (destination, volume, durée), l'écart de prix
   entre fournisseurs, par exemple « Japon 10 Go 15 j : de 18 € à 35 € ». C'est l'argument même
   d'un comparateur. Effort faible.
4. **Détection d'anomalies** : prix aberrants par rapport aux offres comparables, avec une
   méthode IQR ou un z-score sur le €/Go par palier. Peut signaler une erreur d'import et renforce
   la partie qualité. Effort faible.

### Produit et UX

5. **Glisser-déposer un CSV** : prévisualisation des stats et des rejets avant l'import, entièrement
   dans le navigateur avec le même code de validation (zod et `computeStats` sont déjà partagés).
   Effort faible à moyen.
6. **Filtres dans l'URL** pour partager une vue précise, et **export CSV** de la vue filtrée.
   Effort faible.
7. **Comparateur de fournisseurs** : deux fournisseurs côte à côte. Effort moyen.
8. **Outil « Meilleur forfait pour X Go et Y jours à destination de Z »**. Effort moyen.
9. **Histogramme de la distribution des prix**, utile parce que la moyenne (29,30 €) est très
   différente de la médiane (20,70 €). Effort faible.

### Ingénierie

10. **Tests de bout en bout Playwright en CI** (filtres, tri, recherche, mobile) avec des captures
    de régression visuelle. Effort moyen.
11. **Lighthouse CI** avec un budget de performance et d'accessibilité. Effort faible.
12. **Renovate ou Dependabot** pour les dépendances. Effort faible.
13. **`catalog.json` plus léger** (1 Mo brut, 77 Ko en gzip) : colonnes compactes ou chargement
    paresseux. Effort faible.
14. **Un déploiement de prévisualisation par PR** (sous-domaine éphémère). Effort moyen à élevé.

### Présentation

Elle est notée, à travers la méthodologie et l'usage de l'IA.

15. **README** :
    - lien en ligne, schéma d'architecture et de CI/CD ;
    - captures desktop, mobile et sombre, plus un GIF des filtres ;
    - choix assumés ;
    - section « Comment j'ai utilisé l'IA » avec des exemples concrets : gates unlazy, chiffres
      vérifiés par un oracle indépendant (Python ou awk) plutôt que par le code testé, témoins
      négatifs (une erreur injectée doit être détectée), palette dataviz validée par script.
16. **Loom de 2 minutes** : le lien, les 6 KPI, un filtre en direct, puis le pipeline CI/CD.
17. **Texte du mail** : les trois liens et un paragraphe sur l'IA.

## Partie 2 : article SEO

Sujet : « Internet en croisière : quelle eSIM choisir ? ».

1. **Analyse de la concurrence** :
   - les 10 premiers résultats Google sur la requête et ses variantes (« eSIM croisière »,
     « internet bateau croisière ») ;
   - pour chacun : nombre de mots, structure H2/H3, angle, tableaux et FAQ ;
   - les questions « Autres questions posées » de Google.
2. **Longueur cible** : la médiane du top 10, plus 10 à 20 %.
3. **Points à couvrir** :
   - réseau maritime contre réseau terrestre aux escales ;
   - Wi-Fi du bord (prix) ;
   - risque de hors-forfait en mer ;
   - offres eSIM couvrant les escales (Méditerranée, Caraïbes, Europe du Nord) ;
   - forfaits multi-pays ;
   - conseils (mode avion en mer, désactiver l'itinérance) ;
   - FAQ.
4. **Marque MyBestSim** : appels au comparateur, ton de la marque, liens internes vers des pages
   types.
5. **Hébergement** : dans la même app Astro (MDX), à l'adresse `/blog/internet-croisiere-esim`,
   avec titres, gras, liens et suggestions d'images. Ajouter `noindex` ou une canonical pour
   éviter le contenu dupliqué.
