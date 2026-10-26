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

Les étapes du `CLAUDE.md` (« Prochaines étapes », Déploiement) s'appliquent avec ces
changements :

1. Rendre publics les deux packages GHCR : `mybestsim` et `mybestsim-ingest`.
2. Ajouter au compose les services de `deploy/docker-compose.yml` : `mybestsim`,
   `mybestsim-ingest` avec le volume `mybestsim-data`, et `mybestsim-data-init`. Les deux
   premiers sont sur le réseau de `caddy`. Un volume neuf appartient à root, et le service
   tourne en non-root (`bun`) : `mybestsim-data-init` lui donne le volume une fois, avant le
   démarrage du service. L'image web monte le volume en lecture seule sur `/live`, et non sur
   `/data`, qui est le dossier de travail de Caddy.
3. Créer `~/infra/.env.mybestsim` avec `INGEST_TOKEN` et, si besoin, `WEBHOOK_URL`.
4. Le bloc Caddy du VPS ne change pas : `reverse_proxy mybestsim:80`. L'image web route
   elle-même `/api` et `/data`.
5. Lancer `docker compose up -d mybestsim-data-init mybestsim-ingest mybestsim`, puis vérifier que
   `/api/health` et `/data/version.json` répondent. Les deux images ont un `HEALTHCHECK`.
   `node scripts/smoke.mjs https://mybestsim.sbonneau.xyz "$INGEST_TOKEN"` rejoue le smoke test
   de la CI. Il publie une offre de test : à réserver à un volume neuf.

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
