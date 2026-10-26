export type Network = "4G" | "5G";

/** One eSIM offer, normalised from a supplier CSV row. */
export interface Product {
  sku: string;
  provider: string;
  name: string;
  countryCode: string;
  countryName: string;
  /** Gigabytes included, `null` when the offer is unlimited ("Illimité"). */
  dataGb: number | null;
  validityDays: number;
  /** Price in EUR (every supplier file is EUR; other currencies are rejected). */
  price: number;
  network: Network;
  topUp: boolean;
}

export interface RejectedRow {
  file: string;
  /** 1-based line number in the source file, header included. */
  line: number;
  reason: string;
}

export interface FileReport {
  file: string;
  provider: string;
  rows: number;
  valid: number;
}

export interface QualityReport {
  files: number;
  rows: number;
  valid: number;
  rejected: RejectedRow[];
  perFile: FileReport[];
}
