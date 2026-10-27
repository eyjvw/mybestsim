import type { Product } from "./types";

/** What a traveller needs for the port days of one cruise. */
export interface PlanNeed {
  /** Destination codes of the catalogue (country, or region such as EU, AS, NA, WW). */
  codes: readonly string[];
  /** Minimum data; an unlimited offer always qualifies. */
  minGb: number;
  /** Minimum validity, so the plan lasts the whole cruise. */
  minDays: number;
}

export interface Itinerary {
  id: string;
  name: string;
  /** Typical ports of call, for the reader. */
  ports: string;
  need: PlanNeed;
  /** mybestsim.com comparison page for that destination. */
  page: string;
}

const MBS = "https://mybestsim.com/fr";

/** The part 2 article: its URL and dates, shared by the page and the sitemap. */
export const ARTICLE = {
  path: "/blog/internet-croisiere-esim/",
  published: "2026-10-26",
  updated: "2026-10-26",
} as const;

/**
 * Cruise itineraries of the article and the catalogue plan that fits each. A 7-night cruise
 * has about five port days: 5 GB covers maps, messages and photos at roughly 1 GB per port
 * day. Longer crossings need a longer validity, not more data (sea days use none).
 */
export const ITINERARIES: readonly Itinerary[] = [
  {
    id: "mediterranee",
    name: "Méditerranée",
    ports: "Barcelone, Marseille, Gênes, Civitavecchia, Le Pirée, Dubrovnik",
    need: { codes: ["EU"], minGb: 5, minDays: 7 },
    page: `${MBS}/comparaison-meilleure-carte-esim-europe/`,
  },
  {
    id: "fjords",
    name: "Fjords de Norvège",
    ports: "Bergen, Geiranger, Ålesund, Stavanger",
    need: { codes: ["NO"], minGb: 5, minDays: 7 },
    page: `${MBS}/comparaison-meilleure-carte-esim-norvege/`,
  },
  {
    id: "caraibes",
    name: "Caraïbes",
    ports: "La Romana, Punta Cana, Cozumel, Nassau",
    need: { codes: ["DO"], minGb: 5, minDays: 7 },
    page: `${MBS}/meilleure-esim-pour-croisiere-dans-les-caraibes-que-choisir-en-2026/`,
  },
  {
    id: "amerique-du-nord",
    name: "Alaska et Amérique du Nord",
    ports: "Seattle, Juneau, Vancouver, New York",
    need: { codes: ["NA"], minGb: 5, minDays: 7 },
    page: `${MBS}/comparaison-meilleure-carte-esim-amerique-du-nord/`,
  },
  {
    id: "asie",
    name: "Asie",
    ports: "Singapour, Phuket, Hô Chi Minh-Ville, Tokyo",
    need: { codes: ["AS"], minGb: 5, minDays: 7 },
    page: `${MBS}/comparaison-meilleure-carte-esim-asie/`,
  },
  {
    id: "transatlantique",
    name: "Transatlantique et tour du monde",
    ports: "Plusieurs continents, longues journées en mer",
    need: { codes: ["WW"], minGb: 5, minDays: 15 },
    page: `${MBS}/comparaison-meilleure-carte-esim-monde/`,
  },
  {
    id: "fluviale",
    name: "Croisière fluviale",
    ports: "Rhin, Danube, Douro, Seine",
    need: { codes: ["EU"], minGb: 5, minDays: 7 },
    page: `${MBS}/comparaison-meilleure-carte-esim-europe/`,
  },
];

export const fits = (p: Product, need: PlanNeed): boolean =>
  need.codes.includes(p.countryCode) &&
  p.validityDays >= need.minDays &&
  (p.dataGb === null || p.dataGb >= need.minGb);

/**
 * The cheapest offer that covers the need. Ties go to more data (unlimited first), then to
 * the shorter validity actually needed, then to the SKU, so the pick never depends on file order.
 */
export function cheapestPlan(products: Product[], need: PlanNeed): Product | null {
  let best: Product | null = null;
  for (const p of products) {
    if (!fits(p, need)) continue;
    if (!best || compare(p, best) < 0) best = p;
  }
  return best;
}

const dataRank = (p: Product) => (p.dataGb === null ? Number.POSITIVE_INFINITY : p.dataGb);

function compare(a: Product, b: Product): number {
  if (a.price !== b.price) return a.price - b.price;
  if (dataRank(a) !== dataRank(b)) return dataRank(b) - dataRank(a);
  if (a.validityDays !== b.validityDays) return a.validityDays - b.validityDays;
  return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0;
}

/** How many catalogue offers cover the need: what the reader can compare on MyBestSim. */
export const planCount = (products: Product[], need: PlanNeed): number =>
  products.filter((p) => fits(p, need)).length;

/** Cost of `megabytes` billed at `eurPerMb`, rounded to the euro: what roaming at sea costs. */
export const roamingCost = (megabytes: number, eurPerMb: number): number =>
  Math.round(megabytes * eurPerMb);
