# Contrôles indépendants

Ces scripts vérifient ce que le site et le service affichent, **sans réutiliser le code testé**.
Chacun relit les CSV bruts de `data/` avec son propre parseur, volontairement naïf (`lib/raw.mjs`,
`lib/expected.mjs`), recalcule les chiffres, puis compare avec le build, l'API ou le HTML. Un test
unitaire peut se tromper avec le code qu'il teste ; un oracle indépendant, non.

```sh
bun run build && bun run checks   # ceux que la CI lance à chaque PR
bun run checks --local            # plus ceux qui demandent des outils locaux
bun run checks:live               # le site déployé, après une mise en production
```

| Script | Ce qu'il vérifie | Où |
| --- | --- | --- |
| `verify-kpis.mjs` | les six indicateurs du sujet dans `stats.json` et dans le HTML de l'accueil | CI |
| `verify-business.mjs` | économies, fournisseurs les moins chers, prime 5G, offres imbattables, contrôles qualité, histogramme | CI |
| `verify-pages.mjs` | chaque section sur sa page, navigation, page courante, cartes de l'accueil | CI |
| `verify-article.mjs` | article de la partie 2 : au moins aussi long que la médiane des concurrents mesurés (`docs/seo/serp.json`), H1, H2, tableaux, FAQ, title, description, canonical, Open Graph, JSON-LD cohérent avec la page, noindex du domaine de démo, et chaque prix du catalogue recalculé depuis les CSV | CI |
| `verify-brand.mjs` | couleurs MyBestSim et polices auto-hébergées dans le CSS construit, aucune ressource externe | CI |
| `verify-diff.mjs` | le rapport d'import contre un diff indépendant par SKU | CI |
| `verify-ingest.mjs` | publication à travers le vrai serveur ; jeton faux, fichier invalide et garde-fou ne changent rien | CI |
| `verify-inbox-webhook.mjs` | import par dépôt dans `inbox/` et réception du webhook | CI |
| `verify-hardening.mjs` | jeton trop court, limites d'essais et d'aperçus, renvoi inchangé, CLI | CI |
| `verify-smoke-local.mjs` | `scripts/smoke.mjs` contre le vrai serveur | CI |
| `verify-workflows.ts`, `verify-pipeline.ts` | structure de la CI, de Dependabot, du Dockerfile, de Caddy et du compose | CI |
| `verify-toolchain.mjs` | une seule version de Bun partout, lockfile stable | CI |
| `verify-unit.mjs` | chaque module de `src/lib` a ses tests, et ils passent | CI |
| `verify-readme.mjs` | liens, ancres, captures et chaque chiffre cité par le README | CI |
| `verify-palette.mjs` | couleurs des graphiques passées au validateur de palette dataviz | local |
| `verify-article-links.mjs` | chaque lien externe de l'article répond (sources et pages mybestsim.com) | local (réseau) |
| `verify-caddy.mjs` | le Caddyfile de l'image avec un vrai binaire Caddy 2 (la CI le valide aussi dans le conteneur) | local |
| `verify-overflow-control.mjs` | contrôle négatif : le test de débordement mobile doit échouer sur l'ancienne mise en page (tag `pre-mobile-fix`) | local |
| `verify-live.mjs` | site en ligne : commit servi, chiffres, données live, en-têtes de sécurité, sites voisins | après déploiement |

**Les contrôles sont eux-mêmes contrôlés.** `verify-overflow-control.mjs` vérifie que le test de
débordement échoue sur l'ancienne mise en page, et `verify-caddy.mjs` que le validateur rejette une
configuration volontairement cassée. Lors d'un essai, l'oracle métier nourri d'un chiffre faussé
d'une seule unité l'a refusé, et `verify-readme.mjs` refuse un README qui annonce 13 checks en CI
au lieu de 14. `verify-article.mjs` refuse un prix décalé d'un centime, une médiane fausse et un
retrait du noindex ; `verify-article-links.mjs` refuse une URL inventée.

Chaque script affiche un message de réussite précis (`BUSINESS ORACLE PASSED`, etc.) et sort en
erreur au premier écart, avec ce qui était attendu.
