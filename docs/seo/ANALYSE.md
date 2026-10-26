# Analyse de la concurrence : « Internet en croisière : quelle eSIM choisir ? »

Le sujet ne fixe pas de nombre de mots : il demande de « l'analyse de la concurrence ». Ce document
montre comment la longueur, la structure et l'angle de l'article ont été choisis. L'article est en
ligne sur [/blog/internet-croisiere-esim/](https://mybestsim.sbonneau.xyz/blog/internet-croisiere-esim/).

## Méthode

1. **Requêtes visées** : « internet en croisière », « eSIM croisière », « quelle eSIM pour une
   croisière », « wifi croisière prix » (liste exacte dans [serp-urls.json](serp-urls.json)).
2. **Pages qui se classent** : relevées le 26 octobre 2026 avec un moteur de recherche web. Je n'avais
   pas d'outil SEO payant (Ahrefs, Semrush), donc pas de volumes de recherche ni de position exacte
   sur google.fr : la liste reflète les pages qui ressortent, pas un classement.
3. **Mesure** : [`scripts/serp-measure.ts`](../../scripts/serp-measure.ts) télécharge chaque page et
   mesure son HTML : mots du contenu principal (le plus grand `<article>`, sinon `<main>`, sans menu
   ni pied de page), titres, tableaux, FAQ, images, données structurées et dates. Le script a ses tests
   unitaires. Résultat brut : [serp.json](serp.json).
4. **Le même outil mesure l'article**, ce qui rend la comparaison honnête. `checks/verify-article.mjs`
   vérifie ensuite à chaque build que l'article reste au-dessus de la médiane.

## Les pages mesurées

| Page | Mots | H2 | Tableaux | FAQ | Mise à jour |
| --- | ---: | ---: | ---: | --- | --- |
| [participez.com](https://www.participez.com/wifi-croisiere/) | 3 800 | 10 | 4 | non | 2026-04-04 |
| [planete-croisiere.com](https://www.planete-croisiere.com/internet-en-croisere) | 3 625 | 9 | 0 | oui | non indiquée |
| [voyages-exception.fr](https://www.voyages-exception.fr/actualites/1288-internet-en-croisiere-combien-ca-coute) | 3 151 | 8 | 0 | non | 2025-11-24 |
| [simology.io](https://simology.io/fr/blog/internet-mobile-croisiere-esim-vs-wifi-bateau) | 2 961 | 13 | 2 | oui | 2026-09-14 |
| [gomoworld.com](https://www.gomoworld.com/en/blog/internet-croisiere) | 2 492 | 9 | 1 | oui | 2026-05-26 |
| [esim.holafly.com](https://esim.holafly.com/fr/internet-mobile/internet-sur-bateau-de-croisiere/) | 2 263 | 11 | 2 | oui | 2026-04-27 |
| [roamless.com](https://roamless.com/blog/esim-for-cruise-ships) | 2 017 | 11 | 1 | oui | 2026-09-17 |
| [tourisme-solidaire.org](https://www.tourisme-solidaire.org/wifi-en-bateau-de-croisiere-quelles-solutions-pour-rester-connecte/) | 1 257 | 4 | 0 | non | 2026-03-10 |
| [gigsky.com](https://www.gigsky.com/blog/what-to-know-about-cruise-ship-internet-before-you-cruise) | 1 250 | 6 | 1 | non | 2026-09-17 |
| [croisieres.fr](https://www.croisieres.fr/blog-voyage/msc-croisieres-forfaits-wifi-internet/) | 1 163 | 3 | 0 | non | 2026-06-10 |
| [esim.redbullmobile.com](https://esim.redbullmobile.com/fr/blog/esim-pour-les-bateaux-de-croisiere-internet-abordable-en-mer/) | 681 | 13 | 0 | non | 2026-01-23 |
| [francoischarron.com](https://francoischarron.com/gadgets-techno/mobile-tablettes/obtenez-un-forfait-internet-en-croisiere-moins-cher-que-sur-le-bateau/tyw4plx5fj/) | 616 | 7 | 0 | non | 2026-07-23 |

Sur ces 12 pages : **médiane de 2 140 mots** (de 616 à 3 800), médiane de 9 H2, un tableau sur
50 % des pages, une FAQ sur 42 %, des images sur toutes, un schéma `Article` sur 83 %. Les H2
comptent parfois des blocs de site (« Related Blog Posts ») : c'est une borne haute.

## MyBestSim a déjà quatre pages sur le sujet

| Page MyBestSim | Mots | H2 | Tableaux | FAQ | Mise à jour |
| --- | ---: | ---: | ---: | --- | --- |
| [Frais de roaming en croisière dans l'UE](https://mybestsim.com/fr/frais-de-roaming-en-croisiere-dans-lue-guide-2026/) | 2 181 | 9 | 1 | oui | 2026-08-22 |
| [Meilleure eSIM pour les navires de croisière](https://mybestsim.com/fr/meilleure-esim-pour-les-navires-de-croisiere-2026-ce-qui-fonctionne/) | 2 117 | 11 | 2 | oui | 2026-07-11 |
| [eSIM pour une croisière dans les Caraïbes](https://mybestsim.com/fr/meilleure-esim-pour-croisiere-dans-les-caraibes-que-choisir-en-2026/) | 1 970 | 10 | 2 | oui | 2026-07-11 |
| [eSIM pour la croisière et la terre](https://mybestsim.com/fr/esim-pour-la-croisiere-et-la-terre/) | 1 695 | 7 | 2 | oui | 2026-03-09 |

C'est le point le plus important de l'analyse : un cinquième article sur le même thème risquait de
**cannibaliser** les quatre premiers. J'en ai fait la **page pilier** du sujet. Elle répond à la
question générale et renvoie vers chaque page spécialisée (roaming UE, navires, Caraïbes, croisière et
terre) et vers les comparateurs par destination, avec des ancres descriptives.

## Ce que les pages couvrent, et ce qui manque

Toutes traitent le fonctionnement d'internet en mer, le prix du Wi-Fi, la comparaison eSIM et Wi-Fi,
l'installation et quelques astuces. Les pages de MyBestSim, relues une à une, ne donnent pas :

- les **prix du Wi-Fi par compagnie**, ni le **coût du roaming maritime** chez les opérateurs
  français ;
- la **règle européenne** sur les réseaux satellitaires, citée avec sa source officielle ;
- un **conseil par itinéraire** (fjords, transatlantique, croisière fluviale) avec de vrais prix ;
- une **checklist** d'embarquement en une seule liste ;
- un **schéma** des zones de connexion.

## Ce que j'en ai tiré pour l'article

| Décision | Pourquoi |
| --- | --- |
| Environ 3 000 mots | Au-dessus de la médiane (2 140), au niveau des pages les plus complètes, sans remplissage |
| 10 sections H2, chacune ouverte par une réponse directe | Structure lisible, passages repris tels quels par les réponses d'IA et les extraits de Google |
| 4 tableaux : Wi-Fi par compagnie, roaming maritime, eSIM par itinéraire, comparatif | La moitié des concurrents n'en a aucun ; un tableau se compare mieux qu'un paragraphe |
| FAQ de 7 questions et schéma `FAQPage` | Moins de la moitié des concurrents en ont une |
| Prix par itinéraire calculés depuis le catalogue | Donnée propre à MyBestSim, qu'aucun concurrent ne peut copier ; recalculée à chaque build |
| Chaque chiffre sourcé et daté | Confiance du lecteur, signaux E-E-A-T, sources citables |
| Croisière fluviale | Peu traitée par les concurrents, alors qu'elle obéit à des règles plus simples (réseau terrestre tout le long du trajet) |
| Ton MyBestSim : vouvoiement, gras sur l'essentiel, emojis dans les H3 et les astuces, bouton « Comparer » | Repris de la page Thaïlande et des articles de croisière du blog |

## SEO technique de la page

- `title` de 52 caractères et `meta description` de 155 caractères, avec la requête en tête ;
- un seul H1 identique au sujet, URL courte (`/blog/internet-croisiere-esim/`), canonical ;
- Open Graph `article`, dates de publication et de mise à jour visibles et dans les métadonnées ;
- JSON-LD `Article`, `FAQPage` (identique à la FAQ visible) et `BreadcrumbList` ;
- contenu rendu au build, lisible sans JavaScript ;
- suggestions d'images avec texte alternatif, nom de fichier et format (WebP), et un schéma en HTML
  accessible plutôt qu'une image.

**Choix assumé : le domaine de démonstration reste en `noindex`.** L'article est écrit pour être
publié sur mybestsim.com. L'indexer ici créerait du contenu dupliqué le jour de sa publication
là-bas, et c'est le site de MyBestSim qui doit en profiter. Toutes les balises sont prêtes, il suffit
de retirer le `noindex` sur le domaine final.

## Limites

- La liste des pages vient d'un moteur de recherche web, pas d'un outil SEO : pas de volumes de
  recherche ni de position exacte sur google.fr.
- Les prix du Wi-Fi changent selon le navire et la date ; ils sont cités avec leur source et leur date.
- Les prix du catalogue viennent des fichiers fournisseurs du test.
