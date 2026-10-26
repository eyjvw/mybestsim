/** Pseudo country codes used by suppliers for multi-country plans. */
export const REGION_CODES: ReadonlySet<string> = new Set(["EU", "AS", "NA", "WW"]);

export const REGION_NAMES: Readonly<Record<string, string>> = {
  EU: "Europe",
  AS: "Asie",
  NA: "Amérique du Nord",
  WW: "Monde",
};

/**
 * Catalog destinations assumed to be covered by each regional plan. The CSVs do not
 * list coverage, so this follows what Europe / Asia / North America eSIMs usually
 * include (EU + UK, Switzerland and Norway for Europe). "WW" covers everything.
 */
export const REGION_MEMBERS: Readonly<Record<string, ReadonlySet<string>>> = {
  EU: new Set([
    "AT",
    "BE",
    "CH",
    "CZ",
    "DE",
    "ES",
    "FR",
    "GB",
    "GR",
    "HR",
    "IE",
    "IT",
    "NL",
    "NO",
    "PL",
    "PT",
    "SE",
  ]),
  AS: new Set(["CN", "ID", "IN", "JP", "KR", "MY", "PH", "SG", "TH", "VN"]),
  NA: new Set(["CA", "MX", "US"]),
};

export function isRegion(code: string): boolean {
  return REGION_CODES.has(code);
}

/** Regional plans that also work in `code`, closest first. A region is covered by "WW" only. */
export function regionsCovering(code: string): string[] {
  if (code === "WW") return [];
  const regions = Object.entries(REGION_MEMBERS)
    .filter(([, members]) => members.has(code))
    .map(([region]) => region);
  return [...regions, "WW"];
}
