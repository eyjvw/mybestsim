# MyBestSim : test de recrutement

Contexte de travail pour Claude Code, pour reprendre le projet sur une autre machine.

## Le test

- Brief : `Test de recrutement - Stagiaire Développeur IA & Automatisation.pdf` (racine, local,
  hors dépôt).
- Données brutes : `donnees-test-mybestsim.zip` (local, hors dépôt), déjà extraites dans `data/`.

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
- Frontend : la skill `dataviz` pour tout graphique (palette validée par son script).
- **README.md à jour dans chaque PR** qui change une fonctionnalité, une commande ou un choix,
  avec la section « Comment j'ai utilisé l'IA » (critère noté). Son oracle
  `checks/verify-readme.mjs` vérifie liens, captures et chiffres.
- Oracles indépendants dans `checks/` (`checks/README.md`) : `bun run build && bun run checks`
  (lancé par la CI), `--local` pour ceux qui demandent Caddy, le validateur dataviz et le tag
  `pre-mobile-fix`, `bun run checks:live` après un déploiement.
- Discipline de complétion : skill `unlazy` (https://github.com/Leonxlnx/unlazy, commit `1667149`,
  à installer dans `~/.claude/skills/unlazy`).
  - Ledgers : `.unlazy/<lot>/GATES.md`, **locaux, jamais commités** (`.gitignore`). Leurs
    `CHECK:` appellent les scripts de `checks/`.
  - Les approbations de gates sont locales à chaque machine : il faut les ré-approuver avec
    `node ~/.claude/skills/unlazy/scripts/gate-check.mjs --approve --timeout 900 --root $PWD --cwd $PWD .unlazy/<lot>/GATES.md`.
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
bun run e2e        # build + Playwright : projet "static" (dist/ seul) et "live" (service d'ingestion)
bun run dev:live   # build + service d'ingestion sur un volume jetable, http://127.0.0.1:4322
                   # (jeton : dev-token-not-for-production)
bun run import --data-dir <vol> <csv|dossier>   # import en ligne de commande (verrou du volume)
bun run screenshots <url> [jeton]               # captures du README, sur un dev:live neuf
bun run data-report --base <dir> --head data   # rapport Markdown d'import (posté par la CI)
```

Premier lancement e2e sur une machine : `bunx playwright install chromium`, plus les bibliothèques
système (`sudo env "PATH=$PATH" ./node_modules/.bin/playwright install-deps chromium`). Les tests
e2e s'appellent `*.e2e.ts` pour que `bun test` (qui prend aussi `*.spec.ts`) ne les lance pas.

## Architecture

- **Données découplées du build** (`docs/DEPLOY.md`). Le service `server/` (Bun) valide et
  publie les CSV fournisseurs dans un volume : API `POST /api/imports` (jeton), dossier
  `inbox/` surveillé, releases atomiques (`current` → `releases/<id>`), historique, garde-fou
  (`src/lib/guard.ts`), webhook. Le front lit `/data/*.json` et retombe sur l'instantané du
  build (`/catalog.json`) si le service est absent. Le cœur pur d'un import est
  `src/lib/release.ts` (`planImport`), partagé par le serveur et les tests.
- **Le build reste l'instantané de référence.**
  - `src/lib/load.ts` lit `data/*.csv` ;
  - `src/lib/catalog.ts` valide chaque ligne avec zod et produit un rapport qualité ;
  - `src/lib/stats.ts` calcule les stats avec des fonctions pures ;
  - `src/lib/filters.ts` applique les filtres et les (dé)code depuis l'URL ;
  - `src/lib/compare.ts` : forfaits identiques (destination, data, durée), écarts de prix,
    victoires par fournisseur, prime 5G, offres dominées ;
  - `src/lib/audit.ts` : contrôles métier non bloquants (doublons, prix atypiques, incohérences
    de gamme) ;
  - `src/lib/finder.ts` + `regions.ts` : simulateur « quelle eSIM pour mon voyage » ;
  - `src/lib/insights.ts` : constats « À retenir » générés depuis les stats ;
  - `src/lib/diff.ts`, `import-preview.ts`, `report.ts` : diff entre deux imports, aperçu d'import
    côté navigateur, rapport Markdown de PR ;
  - `src/lib/export.ts` (CSV au format fournisseur) et `sample.ts` (fichier d'exemple déterministe).
- **Le HTML est rendu au build** avec tous les KPI. Chaque chiffre porte `data-kpi`/`data-value`
  pour être vérifiable par une machine.
- **L'îlot `src/components/Dashboard.tsx`** charge les données en direct (`src/lib/runtime.ts` :
  `/data/version.json`, puis `catalog` et `changes`) ou, à défaut, `/catalog.json`, et
  recalcule tout avec le même `computeStats` à chaque changement de filtre. Les filtres
  vivent dans l'URL (lien partageable). Les contrôles qualité sont recalculés côté client.
- **Pages** : `/` vue d'ensemble (KPI 1 à 6, « À retenir », dernier import, cartes vers les
  sous-pages), `/analyse` (point 7, économies), `/offres` (tableau, export, simulateur),
  `/qualite` (contrôles, choix assumés), `/import`. Un seul îlot `Dashboard` avec une prop
  `view` ; props de build partagées dans `src/lib/page-props.ts` ; les liens marqués
  `data-keep-filters` reprennent les filtres de l'URL.
- **Page `/import`** (`ImportPreview.tsx`) : glisser-déposer d'un CSV, validé et comparé au
  catalogue dans le navigateur avec le même code que le build, puis bouton « Publier » vers
  le service d'ingestion.
- **DA MyBestSim** (relevée sur mybestsim.com le 26/10/2026) : Poppins auto-hébergée
  (`@fontsource/poppins`), bleu `#007bff`, encre `#0f172a`, filtres en pastilles, cartes
  blanches arrondies, CTA rouge `#de1414`, badges jaunes `#ffcc00`. Clair par défaut même si
  l'OS est en sombre ; sombre bleu nuit en option (`ThemeToggle.astro`, `data-theme`).
- **Endpoints statiques** : `/catalog.json`, `/stats.json` (avec `market` et `audit`),
  `/version.json` (sha du build, utilisé par la CI pour vérifier le déploiement),
  `/exemple-import.csv` (avec 2 lignes invalides), `/exemple-import-valide.csv` (publiable),
  `/data/version.json` (témoin `{"live": false}` pour l'hébergement statique, masqué par
  Caddy en production).
- **Déploiement** :
  - `Dockerfile` à deux cibles : `web` (`caddy:2.11-alpine` sert `dist/`, `/data` et route
    `/api`, voir `docker/Caddyfile`) et `ingest` (Bun, `server/main.ts`) ; services d'exemple
    dans `deploy/docker-compose.yml` ;
  - la CI (`.github/workflows/ci.yml`) ignore `data/**`, `docs/**` et le Markdown ; à chaque PR
    elle lance lint, check, validate, test, build, les oracles de `checks/`, e2e (image
    Playwright) et les deux builds Docker ; au push sur `main`, pas de second e2e ;
  - `.github/workflows/data-report.yml` poste (ou met à jour) un rapport d'import sur chaque PR
    qui touche `data/` ; Dependabot (`.github/dependabot.yml`) couvre bun, actions et docker ;
  - sur `main`, elle pousse `ghcr.io/eyjvw/mybestsim` et `…-ingest` (tags `latest` et sha) ;
  - Watchtower sur le VPS tire l'image `latest` ;
  - le job `verify` (attente du sha en ligne, puis smoke test) ne tourne que si la variable de
    repo `DEPLOY_ENABLED` vaut `true`.

## Faits sur les données

- 18 fichiers, 5 056 lignes, toutes en EUR, aucun doublon de SKU, 0 rejet.
- Mais 219 produits identiques (même fournisseur, forfait, réseau, recharge) existent sous
  plusieurs SKU (458 lignes), jusqu'à +46 % d'écart de prix. Ils sont comptés et signalés.
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
  - les meilleurs €/Go par destination sont surtout des offres 50 Go sur 7 jours ;
  - 1 113 forfaits, dont 1 033 vendus par au moins deux fournisseurs ; plus gros écart : Europe
    illimité 30 j, 94,26 € (Ubigi) contre 154,63 € (aloSIM) ;
  - la 5G ne coûte rien de plus (ratio médian 5G/4G : 1,003 sur 795 forfaits) ;
  - 1 836 offres seulement ne sont battues par aucune autre à la même destination ;
  - contrôles : 8 prix atypiques (≥ 25 % de la médiane du forfait), 351 offres incohérentes
    dans la gamme de leur fournisseur.

## État au 26/10/2026

- Dépôt : `eyjvw/mybestsim`, **privé**, squash seul, branche supprimée au merge. L'ancien dépôt
  `eyjvw/MyBestSim-Dashboard` est abandonné : ses PR montraient d'anciens commits avec un lien de
  session, et il suivait le PDF, le zip et `.unlazy/`.
- L'historique a été rejoué : une PR squash par commit de l'ancien `main`, CI verte à chaque
  fois. Aucun commit ne contient `.unlazy/`, un PDF ou un zip (ignorés dès le premier commit).
  - #1 catalog, #2 CI, #3 stats, #4 dashboard, #5 docs, #6 Bun 1.4.4, #7 logique métier,
    #8 service d'ingestion, #9 UI (comparateur, sous-pages, données live, DA MyBestSim),
    #10 CI (Playwright, smoke des conteneurs), #11 README et docs, #14 garde-fous Dependabot,
    #16 `checks/`, puis le renommage du dépôt. Les numéros manquants sont des PR Dependabot.
  - Le tag `pre-mobile-fix` marque #5, dernière mise en page avant le correctif mobile (contrôle
    négatif de `checks/verify-overflow-control.mjs`).
  - Une PR d'import en SSR + SQLite (autre session, ancien dépôt) a été fermée ; ses meilleures
    idées ont été reprises (rate-limit, `unchanged`, CLI, smoke des conteneurs).
- Images GHCR : `ghcr.io/eyjvw/mybestsim` (web) et `ghcr.io/eyjvw/mybestsim-ingest`. Packages
  privés, mais le compte GHCR du VPS peut les tirer.
- **En ligne depuis le 26/10/2026** sur <https://mybestsim.sbonneau.xyz>. Le job `verify` est
  actif (`DEPLOY_ENABLED=true`) ; `bun run checks:live` passe (sha, chiffres, données live,
  en-têtes, sites voisins).
- Reste à faire : bac à sable public de démo, partie 2 (article SEO), présentation.

## Exploitation du VPS

- Accès : `ssh debian@51.210.7.117` avec la clé `eyjvw` (`~/.ssh/eyjvw` sur cette machine).
  fail2ban bannit vite après des échecs d'authentification : l'erreur devient alors
  `Connection refused` sur le port 22 (`sudo fail2ban-client set sshd unbanip <ip>`).
- `~/infra` est un dépôt git qui contient d'autres sites (vynq.dev, sbonneau.xyz,
  stats.vynq.dev, frappe) et des modifs non commitées qui ne sont pas les nôtres : n'y rien
  committer.
- Les services et le bloc Caddy sont la copie exacte de `deploy/docker-compose.yml` et
  `deploy/Caddyfile` (conteneurs `mybestsim`, `mybestsim-ingest`, `mybestsim-data-init`, volume
  `infra_mybestsim-data`). Sauvegardes d'avant mise en place : `*.before-mybestsim`.
- Le Caddyfile est monté seul dans le conteneur `caddy` : le modifier sans changer son inode
  (pas de `sed -i`), puis `docker exec caddy caddy validate --config /etc/caddy/Caddyfile` avant
  `caddy reload`.
- Jeton de publication : `grep INGEST_TOKEN ~/infra/.env.mybestsim` sur le VPS. Ne jamais
  l'afficher ni le copier ailleurs.
- Watchtower tire `latest` toutes les 60 s. Retour arrière des données : `docs/DEPLOY.md`.

## Prochaines étapes

### 1. Partie 2

Article SEO. Voir le plan dans `docs/ROADMAP.md`.

### 2. Améliorations et refonte frontend

Responsive sur toutes les plateformes. Voir `docs/ROADMAP.md`.

### 3. Présentation

- README : lien en ligne, captures desktop, mobile et sombre dans `docs/`, schéma d'architecture
  et de CI/CD, choix assumés, lancement, usage de l'IA.
- Vidéo Loom de 1 à 2 minutes.
- Texte du mail. Le dépôt est privé : inviter le recruteur, ou le passer en public, avant
  d'envoyer le lien GitHub.

## Reprendre sur une autre machine

```sh
git clone git@github.com:eyjvw/mybestsim.git && cd mybestsim
bun install && bun run validate && bun test && bun run dev
```

Le PDF du sujet, le zip et les ledgers `.unlazy/` ne sont pas dans le dépôt : les copier à la
main. Côté Claude Code, il faut aussi installer la skill `unlazy` (voir plus haut). La skill
`dataviz` est déjà intégrée à Claude Code. Pour l'e2e : `bunx playwright install chromium` et
les bibliothèques système (voir « Commandes »).
