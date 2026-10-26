# Déploiement et flux de données

Le site et les données sont livrés séparément. Le code passe par la CI et une image Docker.
Les fichiers fournisseurs passent par un service d'ingestion, sans rebuild du site.

```text
                 ┌──────────────────────── VPS ─────────────────────────┐
navigateur ──▶ Caddy (VPS, TLS, en-têtes) ──▶ mybestsim (Caddy, image web)
                                                ├─ /          site statique (dist/)
                                                ├─ /data/*    volume, lecture seule
                                                └─ /api/*  ─▶ mybestsim-ingest (Bun)
                                                                 └─ volume mybestsim-data
fournisseur ── SFTP/rsync ──▶ inbox/ du volume ──────────────────┘
```

## Le volume de données

```text
/data/releases/<id>/csv/*.csv     fichiers fournisseurs de la release
/data/releases/<id>/*.json        catalog, stats, changes, version
/data/releases/<id>/report.md     rapport d'import
/data/current -> releases/<id>    lien symbolique, basculé de façon atomique
/data/inbox/                      dépôt de fichiers à importer
/data/inbox/done/<id>/            fichiers importés, avec leur rapport
/data/inbox/rejected/<horodatage>/  fichiers refusés ou retenus, avec leur rapport
/data/imports.jsonl               journal de toutes les tentatives
```

Une release est écrite en entier dans un dossier caché, renommée, puis `current` bascule
d'un coup. Un lecteur voit l'ancienne release ou la nouvelle, jamais un mélange. Les 30
dernières releases sont gardées. Au premier démarrage sur un volume vide, le service publie
les CSV de référence embarqués dans l'image (`data/` du repo).

## Ajouter ou mettre à jour des données

Les quatre chemins passent par le même code : validation zod (un fichier invalide est refusé
en entier), contrôle des SKU en double, garde-fou, nouvelle release, notification. Un fichier
identique au catalogue en ligne est noté `unchanged`, sans nouvelle release.

1. **Depuis le site** : sur `/import`, déposer le CSV, vérifier l'aperçu, saisir le jeton,
   puis cliquer sur « Publier ».
2. **Par l'API** :

   ```sh
   curl -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: text/csv" \
     --data-binary @airalo.csv "https://mybestsim.sbonneau.xyz/api/imports?file=airalo.csv"
   ```

   Le formulaire multipart (champ `file`, plusieurs fichiers possibles) est aussi accepté.

   Ajouter `?dryRun=1` pour un aperçu sans publication (jeton non requis). Ajouter
   `?force=1` pour passer outre le garde-fou après vérification.
   Codes de retour : `201` publié, `200` aperçu ou fichier inchangé, `401` jeton invalide,
   `409` retenu par le garde-fou, `413` fichier trop gros (5 Mo), `415` pas un CSV, `422` refusé
   par le validateur, `429` trop d'essais, `503` publication désactivée.
3. **Par dépôt de fichier** : copier le CSV dans `inbox/` du volume (SFTP, rsync, cron). Le
   service le prend en compte dans les 10 secondes, une fois le fichier stable depuis 2
   secondes.
4. **En ligne de commande**, sur le serveur :

   ```sh
   docker exec mybestsim-ingest bun scripts/import.ts --data-dir /data /data/inbox/airalo.csv
   ```

   Options `--dry-run` et `--force`. Un verrou (`/data/.lock`) empêche la CLI et le service
   d'écrire en même temps.

**Sécurité.** Le jeton doit faire au moins 24 caractères, sinon la publication reste
désactivée. La comparaison se fait en temps constant. Un client qui rate 10 fois le jeton dans
la minute reçoit `429`, même avec le bon jeton, jusqu'à la fin de la fenêtre. Les aperçus
anonymes sont limités à 30 par minute. Le client est identifié par `X-Forwarded-For` : le Caddy
de l'image fait confiance au proxy du VPS (plages privées) et ajoute l'adresse réelle.

Un fichier remplace les offres des fournisseurs qu'il contient, et garde le nom de fichier
existant de ce fournisseur. Un nouveau fournisseur est ajouté sous le nom du fichier déposé.

**Garde-fou.** Un import est retenu (`409`) si, pour un fournisseur d'au moins 10 offres :

- plus de 20 % de ses prix varient de 30 % ou plus ;
- ou plus de 50 % de ses offres disparaissent.

Ces deux cas viennent presque toujours d'un export cassé, pas d'un vrai mouvement du marché.

**Retour arrière.** Pour revenir à la release précédente :

```sh
cd /data && ln -sfn releases/<id> .current-rollback && mv -T .current-rollback current
```

## Variables d'environnement du service d'ingestion

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `INGEST_TOKEN` | jeton exigé pour publier, 24 caractères minimum (sinon publication désactivée) | aucun |
| `WEBHOOK_URL` | notification après chaque import (Discord, Slack ou JSON générique) | aucun |
| `SITE_URL` | lien ajouté aux notifications | aucun |
| `DATA_DIR` | volume de données | `/data` |
| `SEED_DIR` | CSV publiés au premier démarrage | `/app/seed` |
| `MAX_UPLOAD_MB` | taille maximale d'un envoi | `5` |
| `INBOX_INTERVAL_MS` | fréquence de lecture de `inbox/` | `10000` |

Le jeton se génère avec `openssl rand -hex 32` et se range dans `~/infra/.env.mybestsim`.
Ce fichier n'est jamais commité ni affiché.

## Mise en place sur le VPS

Le site tourne sur le VPS depuis le 26 octobre 2026, à côté d'autres sites servis par le même
Caddy. `deploy/` contient la copie exacte de ce qui y a été ajouté.

1. **Sauvegardes** : `docker-compose.yml.before-mybestsim` et `caddy/Caddyfile.before-mybestsim`
   dans `~/infra`, avant toute modification.
2. **Secret** : `~/infra/.env.mybestsim` (droits 600) contient `INGEST_TOKEN`, généré sur le VPS
   avec `openssl rand -hex 32` et jamais affiché, et, si besoin, `WEBHOOK_URL`. Le `.gitignore`
   de `~/infra` ignore `.env.*`.
3. **Services** : ceux de [`deploy/docker-compose.yml`](../deploy/docker-compose.yml)
   (`mybestsim`, `mybestsim-ingest`, `mybestsim-data-init` et le volume `mybestsim-data`), sur le
   réseau par défaut du compose, celui de `caddy`. Un volume neuf appartient à root, et le
   service tourne en non-root (`bun`) : `mybestsim-data-init` lui donne le volume une fois, avant
   le démarrage du service. L'image web monte le volume en lecture seule sur `/live`, et non sur
   `/data`, qui est le dossier de travail de Caddy. Démarrage :
   `docker compose up -d mybestsim-data-init mybestsim-ingest mybestsim`.
4. **Caddy** : le bloc de [`deploy/Caddyfile`](../deploy/Caddyfile) (`reverse_proxy mybestsim:80`,
   HSTS, CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, sans en-tête
   `Server`). L'image web route elle-même `/api` et `/data`. Le Caddyfile est monté seul dans le
   conteneur : il faut le modifier sans changer son inode, sinon le conteneur garde l'ancien.
   Puis `docker exec caddy caddy validate --config /etc/caddy/Caddyfile`, et le reload
   seulement si la validation passe. Le bloc ne s'ajoute qu'une fois le DNS en place, pour
   éviter des échecs de certificat Let's Encrypt, limités en nombre par heure.
5. **Vérification** : la variable de dépôt `DEPLOY_ENABLED` vaut `true`, donc le job `verify`
   de la CI attend le sha en ligne après chaque merge. `bun run checks:live` vérifie en plus les
   données live, les en-têtes et les sites voisins.
   `node scripts/smoke.mjs https://mybestsim.sbonneau.xyz "$INGEST_TOKEN"` rejoue le smoke test
   des conteneurs ; il publie une offre de test, donc à réserver à un volume neuf.

## CI et coût

- Un changement de données ne déclenche plus la CI (`paths-ignore: data/**`). Une PR qui
  touche `data/` reçoit seulement le rapport d'import (`data-report.yml`, environ une minute).
- Les tests navigateur tournent sur les PR, pas une seconde fois au merge, dans l'image
  officielle Playwright de la version utilisée : Chromium et ses bibliothèques y sont déjà.
  L'installation apt sur le runner prenait 14 minutes.
- Sur une PR, les deux images sont construites et démarrées ensemble : initialisation du
  volume, publication à travers Caddy, processus non-root, release conservée après
  redémarrage du service.
- Sur `main`, les images `web` et `ingest` sont construites en parallèle et poussées, avec un
  cache par cible.

Le dépôt est privé : ses minutes Actions sont limitées (2 000 par mois sur l'offre gratuite de
GitHub). Le découplage les préserve, et un import quotidien ne devrait de toute façon jamais
attendre un build.
