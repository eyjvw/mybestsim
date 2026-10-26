import { afterAll, describe, expect, test } from "bun:test";
import type { ImportOutcome } from "./store";
import { sendWebhook, webhookBody } from "./webhook";

const outcome: ImportOutcome = {
  status: "published",
  importId: "20261026T100000Z-abcd",
  reasons: [],
  providers: ["Airalo"],
  summary: { added: 3, removed: 2, up: 3, down: 3, modified: 0 },
  rejected: [],
  report: "# r",
};

describe("webhookBody", () => {
  test("Discord, Slack and generic shapes", () => {
    const d = webhookBody("https://discord.com/api/webhooks/1/x", outcome, "https://site") as {
      content: string;
    };
    expect(d.content).toContain("✅ Import 20261026T100000Z-abcd publié (Airalo) : +3 / −2 offres");
    expect(d.content).toContain("https://site");
    expect(webhookBody("https://hooks.slack.com/services/x", outcome)).toHaveProperty("text");
    expect(webhookBody("https://example.com/hook", outcome)).toMatchObject({
      event: "import.published",
      importId: outcome.importId,
    });
  });

  test("held imports say why", () => {
    const held = {
      ...outcome,
      status: "held" as const,
      reasons: ["Airalo : 9 prix sur 20 varient"],
    };
    const b = webhookBody("https://example.com/h", held) as { text: string };
    expect(b.text).toContain("⚠️ Import retenu par le garde-fou");
    expect(b.text).toContain("• Airalo : 9 prix sur 20 varient");
  });
});

describe("sendWebhook", () => {
  const received: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      received.push(await req.json());
      return new Response(null, { status: req.url.endsWith("/fail") ? 500 : 204 });
    },
  });
  afterAll(() => server.stop(true));

  test("posts JSON and reports failures without throwing", async () => {
    expect(await sendWebhook(`http://127.0.0.1:${server.port}/ok`, outcome)).toBe(true);
    expect(received[0]).toMatchObject({ event: "import.published" });
    expect(await sendWebhook(`http://127.0.0.1:${server.port}/fail`, outcome)).toBe(false);
    expect(await sendWebhook("http://127.0.0.1:1/unreachable", outcome)).toBe(false);
    expect(await sendWebhook(undefined, outcome)).toBe(false);
    expect(await sendWebhook("http://127.0.0.1:1/x", { ...outcome, status: "preview" })).toBe(
      false,
    );
  });
});
