# MyBestSim : test de recrutement

Contexte de travail pour Claude Code, pour reprendre le projet sur une autre machine. Fichier
temporaire : le repo final sera recréé proprement à la fin (voir « Repo final »).

## Le test

- Brief : `Test de recrutement - Stagiaire Développeur IA & Automatisation.pdf` (racine).
- Données brutes : `donnees-test-mybestsim.zip`, déjà extraites dans `data/`.

**Partie 1, dashboard.** Programme ou automatisation qui lit les 18 CSV fournisseurs et génère un
dashboard en ligne (simple lien, aucune installation). Il doit afficher :

1. le nombre total de cartes eSIM ;
2. le nombre de produits à plus de 100 € ;
3. la fourchette de prix min/max ;
4. la data moyenne (Go) par carte ;
5. le prix moyen global ;
6. la répartition par fournisseur ;
7. des stats bonus.

Le lien GitHub est optionnel.

**Partie 2, article SEO.** Sujet : « Internet en croisière : quelle eSIM choisir ? », pour la
marque MyBestSim. La longueur et la structure viennent de l'analyse de la concurrence. Il faut une
mise en forme web (titres, gras, liens, suggestions d'images) et un hébergement en ligne : un
fichier joint ne suffit pas.

**Rendu par mail** : lien du dashboard, lien GitHub, lien de l'article et quelques lignes sur
l'usage de l'IA.

**Critères** : le résultat, l'autonomie (choix assumés et expliqués), la méthodologie et l'usage de
l'IA.

## Façon de travailler

- Répondre à l'utilisateur en français, style télégraphique (caveman). Code, commits et PR se
  rédigent normalement, en anglais.
- Ne jamais committer sans avoir dit avant ce qui a été fait. Lancer en local pour montrer.
- Tout passe par Bun : `bun run check` (astro check), jamais `tsc` ni npm.
- GitHub Flow :
  - une branche, une PR, puis squash merge une fois la CI verte ;
  - le squash est le seul mode autorisé, et la branche est supprimée au merge ;
  - Conventional Commits : sujet de 50 caractères maximum, impératif, minuscule après le type ;
  - le corps du commit explique le pourquoi.
- Attribution :
  - finir chaque commit et chaque corps de squash par
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ;
  - finir chaque PR par `🤖 Generated with [Claude Code](https://claude.com/claude-code)` ;
  - **jamais** de ligne `Claude-Session:` ni de lien de session, nulle part.
- Frontend : utiliser le MCP `magic` (21st.dev) quand c'est pertinent, et la skill `dataviz` pour
  tout graphique (palette validée par son script).
- Discipline de complétion : skill `unlazy` (https://github.com/Leonxlnx/unlazy, commit `1667149`,
  à installer dans `~/.claude/skills/unlazy`).
  - Ledger : `.unlazy/part1/GATES.md`.
  - Les approbations de gates sont locales à chaque machine : il faut les ré-approuver avec
    `node ~/.claude/skills/unlazy/scripts/gate-check.mjs --approve --root $PWD --cwd $PWD .unlazy/part1/GATES.md`.
- Modifs sur le VPS :
  - toujours avec l'accord explicite de l'utilisateur ;
  - sauvegarde avant modif (convention `.before-<sujet>`) ;
  - `caddy validate` avant tout reload ;
  - ne jamais afficher les valeurs du `.env`.

## Stack

| Brique | Version |
| --- | --- |
| Runtime et gestionnaire de paquets | Bun 1.4.4 (`bunfig.toml` : installs exactes) |
| Site | Astro 7.4.2 en sortie statique, îlot React 19 (`client:load`) |
| Styles | Tailwind v4 (`@tailwindcss/vite`) |
| Lint et format | Biome 2.6 |
| Typage | TypeScript 6.0.3 (pas de 7 : `@astrojs/check` 0.9 exige TS 6 ou moins) |
| CSV et validation | papaparse, zod |

## Commandes

```sh
bun install
bun run dev        # http://127.0.0.1:4321
bun run lint       # biome ci
bun run format     # biome check --write
bun run check      # astro check (typage)
bun run validate   # rapport d'import CSV, exit 1 si une ligne est rejetée
bun test
bun run build
```

## Architecture

- **Le build est l'automatisation.**
  - `src/lib/load.ts` lit `data/*.csv` ;
  - `src/lib/catalog.ts` valide chaque ligne avec zod et produit un rapport qualité ;
  - `src/lib/stats.ts` calcule les stats avec des fonctions pures ;
  - `src/lib/filters.ts` applique les filtres.
- **Le HTML est rendu au build** avec tous les KPI. Chaque chiffre porte `data-kpi`/`data-value`
  pour être vérifiable par une machine.
- **L'îlot `src/components/Dashboard.tsx`** charge `/catalog.json` et recalcule tout avec le même
  `computeStats` à chaque changement de filtre.
- **Endpoints statiques** : `/catalog.json`, `/stats.json`, `/version.json` (sha du build, utilisé
  par la CI pour vérifier le déploiement).
- **Déploiement** :
  - `Dockerfile` : build avec Bun, puis `caddy:2.11-alpine` sert `dist/` (`docker/Caddyfile`) ;
  - la CI (`.github/workflows/ci.yml`) lance lint, check, validate, test, build et le build
    Docker à chaque PR ;
  - sur `main`, elle pousse l'image `ghcr.io/eyjvw/mybestsim-dashboard` (tags `latest` et sha) ;
  - Watchtower sur le VPS tire l'image `latest` ;
  - le job `verify` (attente du sha en ligne, puis smoke test) ne tourne que si la variable de
    repo `DEPLOY_ENABLED` vaut `true`.

## Faits sur les données

- 18 fichiers, 5 056 lignes, toutes en EUR, aucun doublon de SKU, 0 rejet.
- 653 offres « Illimité » ont `data_gb` vide. Elles sont exclues de la moyenne data et comptées à
  part.
- Pseudo-codes de région :
  - `EU`, `WW` ;
  - `AS` = Asie (pas les Samoa américaines) ;
  - `NA` = Amérique du Nord (pas la Namibie).

  Cela donne 54 destinations : 50 pays et 4 régions.
- Aucun prix n'est exactement à 100 € (les plus proches : 99,39 et 100,49). Le seuil est appliqué
  au sens strict (`> 100`).
- Chiffres de référence, mesurés indépendamment en Python et verrouillés par des golden tests :

  | Mesure | Valeur |
  | --- | --- |
  | Total | 5 056 |
  | Plus de 100 € | 56 |
  | Prix min / max | 5,36 € / 154,63 € |
  | Prix moyen | 29,30 € |
  | Prix médian | 20,70 € |
  | Data moyenne | 14,49 Go |
  | Fournisseur le plus fourni | Airalo, 722 offres |
  | Fournisseur le moins fourni | 4S eSIM, 92 offres |

- Insights :
  - le €/Go médian est proche entre fournisseurs, de 2,34 à 2,93 (JamboSIM le moins cher, 4S eSIM
    le plus cher) ;
  - le prix médian de l'illimité (51,28 €) est inférieur à celui du 50 Go (58,75 €) ;
  - les meilleurs €/Go par destination sont surtout des offres 50 Go sur 7 jours.

## État au 26/10/2026

- `main` :
  - le commit initial plus les PR #1 (catalog), #2 (ci), #3 (stats) et #4 (dashboard), auxquels
    s'ajoute cette PR ;
  - CI verte et image publiée sur GHCR (package **privé** pour l'instant).
- Gates unlazy : G0 à G3 sont MET ; G4 à G8 ne le sont pas (repo final, VPS, live, test
  navigateur en ligne, README).
- Le site n'est **pas encore déployé**. Le DNS `mybestsim.sbonneau.xyz` ne résolvait pas encore le
  26/10. L'utilisateur doit ajouter l'enregistrement A `mybestsim` vers `51.210.7.117` chez
  Namecheap.

## Prochaines étapes

### 1. Déploiement

1. **Package GHCR.** Le VPS est connecté à `ghcr.io` en `vynq-studio` : il ne peut pas tirer un
   package privé d'`eyjvw`.
   - Recommandé : passer le package en public. Le repo, lui, reste privé.
   - Autre option : donner l'accès en lecture à `vynq-studio`.
2. **VPS** (`ssh -i ~/.ssh/id_ed25519 debian@51.210.7.117`), avec accord à chaque étape :
   1. Sauvegarder `~/infra/caddy/Caddyfile` en `Caddyfile.before-mybestsim`, et
      `~/infra/docker-compose.yml` en `docker-compose.yml.before-mybestsim`.
   2. Dans le compose, ajouter le service `mybestsim` :
      - image `ghcr.io/eyjvw/mybestsim-dashboard:latest` ;
      - `expose: ["80"]` ;
      - label `com.centurylinklabs.watchtower.enable: "true"` ;
      - même réseau que `caddy`.
   3. Ajouter le bloc Caddy `mybestsim.sbonneau.xyz` avec `reverse_proxy mybestsim:80` et ces
      en-têtes :
      - HSTS ;
      - `X-Frame-Options DENY` ;
      - `nosniff` ;
      - `Referrer-Policy strict-origin-when-cross-origin` ;
      - `Permissions-Policy` ;
      - CSP : `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'` ;
      - `-Server`.
   4. Lancer `docker exec caddy caddy validate --config /etc/caddy/Caddyfile`, puis recharger
      Caddy.
   5. Lancer `docker compose up -d mybestsim`.
3. **Activer le job `verify`** : `gh variable set DEPLOY_ENABLED --body true`.
4. **Vérifier** : gates G5 et G6 (`.unlazy/part1/checks/verify-live.mjs`), puis G7 à la main dans
   un navigateur sur l'URL en ligne.

### 2. Partie 2

Article SEO. Voir le plan dans `docs/ROADMAP.md`.

### 3. Améliorations et refonte frontend

Responsive sur toutes les plateformes. Voir `docs/ROADMAP.md`.

### 4. Présentation

- README : lien en ligne, captures desktop, mobile et sombre dans `docs/`, schéma d'architecture
  et de CI/CD, choix assumés, lancement, usage de l'IA.
- Vidéo Loom de 1 à 2 minutes.
- Texte du mail.

### 5. Repo final

Recréer un repo propre, rejouer l'historique en PR et le rendre public. En effet :

- les onglets « Commits » des PR #1 à #4 du repo actuel montrent encore d'anciens commits avec un
  lien de session ;
- le ledger `verify-repo.mjs` refuse le PDF, le zip et `.unlazy/` dans le suivi git.

À ne **pas** inclure dans le repo final : le PDF, le zip, `.unlazy/`, ce fichier `CLAUDE.md`.

## Reprendre sur une autre machine

```sh
git clone git@github.com:eyjvw/MyBestSim-Dashboard.git && cd MyBestSim-Dashboard
bun install && bun run validate && bun test && bun run dev
```

Côté Claude Code, il faut aussi installer la skill `unlazy` (voir plus haut) et le MCP `magic`
pour le frontend. La skill `dataviz` est déjà intégrée à Claude Code.
