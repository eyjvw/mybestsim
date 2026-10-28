const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurRound = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const int = new Intl.NumberFormat("fr-FR");
const dec = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

const DASH = "—";

export const formatEur = (n: number | null) => (n === null ? DASH : eur.format(n));
/** Whole euros, for large sums where cents are noise ("1 584 €"). */
export const formatEurRound = (n: number | null) => (n === null ? DASH : eurRound.format(n));
export const formatInt = (n: number | null) => (n === null ? DASH : int.format(n));
export const formatGb = (n: number | null) => (n === null ? DASH : `${dec.format(n)} Go`);
export const formatPct = (n: number | null) => (n === null ? DASH : pct.format(n));
export const formatEurPerGb = (n: number | null) => (n === null ? DASH : `${dec.format(n)} €/Go`);
export const formatTier = (gb: number | null) => (gb === null ? "Illimité" : `${gb} Go`);

const day = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });
/** "2026-10-28" → "28 octobre 2026", the same on every time zone. */
export const formatDay = (isoDate: string) => day.format(new Date(`${isoDate}T00:00:00Z`));

interface Plan {
  countryName: string;
  dataGb: number | null;
  validityDays: number;
}

/** "Europe Illimité 30 j": a plan as the dashboard names it. */
export const planLabel = (p: Plan) =>
  `${p.countryName} ${formatTier(p.dataGb)} ${p.validityDays} j`;

/** Cheapest and dearest offers, naming the provider once when both come from the same one. */
export const rangeLabel = (
  cheap: Plan & { provider: string },
  dear: Plan & { provider: string },
) =>
  cheap.provider === dear.provider
    ? `${planLabel(cheap)} → ${planLabel(dear)}, chez ${cheap.provider}`
    : `${planLabel(cheap)} (${cheap.provider}) → ${planLabel(dear)} (${dear.provider})`;
