import type { ImportOutcome } from "./store";

/** Message sent after each import, shaped for Discord, Slack or any JSON endpoint. */
export function webhookBody(url: string, outcome: ImportOutcome, siteUrl?: string) {
  const s = outcome.summary;
  const verdict =
    outcome.status === "published"
      ? `✅ Import ${outcome.importId} publié`
      : outcome.status === "held"
        ? "⚠️ Import retenu par le garde-fou"
        : "❌ Import refusé";
  const line = `${verdict} (${outcome.providers.join(", ") || "aucun fournisseur"}) : +${s.added} / −${s.removed} offres, ${s.up} hausses, ${s.down} baisses.`;
  const reasons = outcome.reasons.length
    ? `\n${outcome.reasons.map((r) => `• ${r}`).join("\n")}`
    : "";
  const link = siteUrl && outcome.status === "published" ? `\n${siteUrl}` : "";
  const text = `${line}${reasons}${link}`;
  const host = new URL(url).hostname;
  // Discord caps content at 2 000 characters; Slack incoming webhooks take `text`.
  if (host.endsWith("discord.com") || host.endsWith("discordapp.com"))
    return { content: text.slice(0, 1900) };
  if (host === "hooks.slack.com") return { text };
  return { event: `import.${outcome.status}`, text, ...outcome };
}

/** Fire-and-forget notification: a failing webhook never fails an import. */
export async function sendWebhook(
  url: string | undefined,
  outcome: ImportOutcome,
  siteUrl?: string,
): Promise<boolean> {
  if (!url || outcome.status === "preview" || outcome.status === "unchanged") return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody(url, outcome, siteUrl)),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`webhook ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`webhook failed: ${String(e)}`);
    return false;
  }
}
