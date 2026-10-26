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
