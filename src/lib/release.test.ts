import { describe, expect, test } from "bun:test";
import { HEADER } from "./fixtures";
import { loadCatalog } from "./load";
import { planImport, releaseArtifacts, safeFileName } from "./release";
import { buildSampleImport } from "./sample";

const row = (sku: string, provider: string, price: number, country = "FR,France") =>
  `${sku},${provider},eSIM France 5 Go 7 jours,${country},5,5 Go,7,${price},EUR,4G,oui`;
const csv = (...rows: string[]) => `${[HEADER, ...rows].join("\n")}\n`;
const current = [
  {
    file: "alpha.csv",
    text: csv(...Array.from({ length: 12 }, (_, i) => row(`a-${i}`, "Alpha", 10 + i))),
  },
  { file: "beta.csv", text: csv(row("b-1", "Beta", 9)) },
];

describe("safeFileName", () => {
  test("strips paths, accents and odd characters", () => {
    expect(safeFileName("../../etc/Fournisseur Été.CSV")).toBe("fournisseur-ete.csv");
    expect(safeFileName("..csv")).toBe("import.csv");
    expect(safeFileName("data")).toBe("data.csv");
  });
});

describe("planImport", () => {
  test("a provider's file replaces its current file and keeps its name", () => {
    const up = csv(
      ...Array.from({ length: 12 }, (_, i) => row(`a-${i}`, "Alpha", i === 0 ? 11 : 10 + i)),
    );
    const plan = planImport(current, [{ file: "Export du jour.csv", text: up }]);
    expect(plan.status).toBe("published");
    expect(plan.files.map((f) => f.file)).toEqual(["alpha.csv", "beta.csv"]);
    expect(plan.diff.repriced.map((c) => c.after.sku)).toEqual(["a-0"]);
    expect(plan.products).toHaveLength(13);
  });

  test("a new provider is added under its own name, even if the upload name collides", () => {
    const plan = planImport(current, [
      { file: "alpha.csv", text: csv(row("z-1", "Zeta Mobile", 5)) },
    ]);
    expect(plan.status).toBe("published");
    expect(plan.files.map((f) => f.file)).toEqual(["alpha.csv", "beta.csv", "zeta-mobile.csv"]);
    expect(plan.diff.added).toHaveLength(1);
  });

  test("one invalid row rejects the whole file and changes nothing", () => {
    const bad = csv(row("a-0", "Alpha", 10), "a-x,Alpha,eSIM,FR,France,5,5 Go,7,9,USD,4G,oui");
    const plan = planImport(current, [{ file: "alpha.csv", text: bad }]);
    expect(plan.status).toBe("rejected");
    expect(plan.reasons[0]).toContain("refusé en entier");
  });

  test("a SKU already used by another provider is a conflict", () => {
    const plan = planImport(current, [{ file: "gamma.csv", text: csv(row("b-1", "Gamma", 5)) }]);
    expect(plan.status).toBe("rejected");
    expect(plan.reasons[0]).toContain("sku en double");
  });

  test("the guard holds an abnormal file unless forced", () => {
    const up = csv(...Array.from({ length: 12 }, (_, i) => row(`a-${i}`, "Alpha", (10 + i) * 2)));
    expect(planImport(current, [{ file: "alpha.csv", text: up }]).status).toBe("held");
    expect(planImport(current, [{ file: "alpha.csv", text: up }], { force: true }).status).toBe(
      "published",
    );
  });

  test("an empty upload is rejected", () => {
    expect(planImport(current, []).status).toBe("rejected");
    expect(planImport(current, [{ file: "x.csv", text: `${HEADER}\n` }]).reasons).toContain(
      "Le fichier ne contient aucune offre.",
    );
  });

  test("the built-in valid sample publishes against the real catalog", () => {
    const { products } = loadCatalog();
    const text = buildSampleImport(products, "Airalo", { invalidRows: false });
    const files = [...new Bun.Glob("*.csv").scanSync("data")].sort().map((f) => ({
      file: f,
      text: require("node:fs").readFileSync(`data/${f}`, "utf8") as string,
    }));
    const plan = planImport(files, [{ file: "airalo.csv", text }]);
    expect(plan.status).toBe("published");
    expect(plan.products).toHaveLength(products.length + 1);
  });
});

describe("releaseArtifacts", () => {
  test("catalog, stats, changes and version for one release", () => {
    const plan = planImport(current, [{ file: "beta.csv", text: csv(row("b-1", "Beta", 8)) }]);
    const meta = {
      importId: "i2",
      importedAt: "2026-10-26T10:00:00.000Z",
      previousImportId: "i1",
      source: "api" as const,
    };
    const a = releaseArtifacts(plan, meta);
    expect(a["catalog.json"].products).toHaveLength(13);
    expect(a["stats.json"].total).toBe(13);
    expect(a["changes.json"]).toMatchObject({ importId: "i2", previousImportId: "i1", down: 1 });
    expect(a["version.json"]).toMatchObject({
      importId: "i2",
      source: "api",
      files: ["alpha.csv", "beta.csv"],
    });
    expect(releaseArtifacts(plan, { ...meta, previousImportId: null })["changes.json"]).toBeNull();
  });
});
