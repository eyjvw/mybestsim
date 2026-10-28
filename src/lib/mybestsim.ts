/**
 * mybestsim.com page of each catalog destination, by country code (path under /fr/). Every
 * address was found in mybestsim.com's sitemap and answered 200 on MYBESTSIM_CHECKED_ON. Most
 * follow "comparaison-meilleure-carte-esim-<pays>"; Maroc, Royaume-Uni and Thaïlande moved to
 * "meilleure-carte-esim-<pays>", and their old address answers 410. A destination missing from
 * this map (added later by an import) is simply not linked.
 */
export const MYBESTSIM_CHECKED_ON = "2026-10-28";

export const MYBESTSIM_PAGES: Readonly<Record<string, string>> = {
  AE: "comparaison-meilleure-carte-esim-emirats-arabes-unis",
  AR: "comparaison-meilleure-carte-esim-argentine",
  AS: "comparaison-meilleure-carte-esim-asie",
  AT: "comparaison-meilleure-carte-esim-autriche",
  AU: "comparaison-meilleure-carte-esim-australie",
  BE: "comparaison-meilleure-carte-esim-belgique",
  BR: "comparaison-meilleure-carte-esim-bresil",
  CA: "comparaison-meilleure-carte-esim-canada",
  CH: "comparaison-meilleure-carte-esim-suisse",
  CL: "comparaison-meilleure-carte-esim-chili",
  CN: "comparaison-meilleure-carte-esim-chine",
  CO: "comparaison-meilleure-carte-esim-colombie",
  CZ: "comparaison-meilleure-carte-esim-republique-tcheque",
  DE: "comparaison-meilleure-carte-esim-allemagne",
  DO: "comparaison-meilleure-carte-esim-republique-dominicaine",
  EG: "comparaison-meilleure-carte-esim-egypte",
  ES: "comparaison-meilleure-carte-esim-espagne",
  EU: "comparaison-meilleure-carte-esim-europe",
  FR: "comparaison-meilleure-carte-esim-france",
  GB: "meilleure-carte-esim-royaume-uni",
  GR: "comparaison-meilleure-carte-esim-grece",
  HR: "comparaison-meilleure-carte-esim-croatie",
  ID: "comparaison-meilleure-carte-esim-indonesie",
  IE: "comparaison-meilleure-carte-esim-irlande",
  IL: "comparaison-meilleure-carte-esim-israel",
  IN: "comparaison-meilleure-carte-esim-inde",
  IT: "comparaison-meilleure-carte-esim-italie",
  JO: "comparaison-meilleure-carte-esim-jordanie",
  JP: "comparaison-meilleure-carte-esim-japon",
  KE: "comparaison-meilleure-carte-esim-kenya",
  KR: "comparaison-meilleure-carte-esim-coree-du-sud",
  MA: "meilleure-carte-esim-maroc",
  MX: "comparaison-meilleure-carte-esim-mexique",
  MY: "comparaison-meilleure-carte-esim-malaisie",
  NA: "comparaison-meilleure-carte-esim-amerique-du-nord",
  NG: "comparaison-meilleure-carte-esim-nigeria",
  NL: "comparaison-meilleure-carte-esim-pays-bas",
  NO: "comparaison-meilleure-carte-esim-norvege",
  NZ: "comparaison-meilleure-carte-esim-nouvelle-zelande",
  PE: "comparaison-meilleure-carte-esim-perou",
  PH: "comparaison-meilleure-carte-esim-philippines",
  PL: "comparaison-meilleure-carte-esim-pologne",
  PT: "comparaison-meilleure-carte-esim-portugal",
  QA: "comparaison-meilleure-carte-esim-qatar",
  SA: "comparaison-meilleure-carte-esim-arabie-saoudite",
  SE: "comparaison-meilleure-carte-esim-suede",
  SG: "comparaison-meilleure-carte-esim-singapour",
  TH: "meilleure-carte-esim-thailande",
  TR: "comparaison-meilleure-carte-esim-turquie",
  TZ: "comparaison-meilleure-carte-esim-tanzanie",
  US: "comparaison-meilleure-carte-esim-etats-unis",
  VN: "comparaison-meilleure-carte-esim-vietnam",
  WW: "comparaison-meilleure-carte-esim-monde",
  ZA: "comparaison-meilleure-carte-esim-afrique-du-sud",
};

export function mybestsimUrl(countryCode: string): string | null {
  const path = MYBESTSIM_PAGES[countryCode];
  return path ? `https://mybestsim.com/fr/${path}/` : null;
}
