/**
 * Tooltip placement and wording for the charts. A tooltip over one of the first or last columns
 * is anchored to that side, so it never leaves the chart on a narrow screen.
 */
export type TooltipAlign = "start" | "center" | "end";

export function tooltipAlign(index: number, count: number): TooltipAlign {
  if (count < 5) return "center";
  if (index < 2) return "start";
  if (index > count - 3) return "end";
  return "center";
}

/** "1 offre", "28 offres" (French: the plural starts at 2). */
export const offersLabel = (n: number, format: (n: number) => string = String) =>
  `${format(n)} ${n >= 2 ? "offres" : "offre"}`;

/** Roving focus inside a chart: arrows step, Home and End jump, other keys are left alone. */
export function nextIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowRight" || key === "ArrowUp") return Math.min(current + 1, count - 1);
  if (key === "ArrowLeft" || key === "ArrowDown") return Math.max(current - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
