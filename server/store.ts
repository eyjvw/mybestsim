import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { hasChanges } from "../src/lib/diff";
import type { GuardConfig } from "../src/lib/guard";
import {
  type ImportStatus,
  planImport,
  type ReleaseMeta,
  releaseArtifacts,
  type SupplierFile,
} from "../src/lib/release";
import type { RejectedRow } from "../src/lib/types";

/**
 * Data volume layout, served read-only by Caddy under /data:
 *
 *   releases/<id>/csv/*.csv          supplier files of that release
 *   releases/<id>/{catalog,stats,changes,version}.json, report.md
 *   current -> releases/<id>         symlink, swapped atomically on publish
 *   inbox/                           drop CSVs here to import them
 *   imports.jsonl                    one line per import attempt
 */

export interface ImportOutcome {
  /** `unchanged`: valid, but identical to the current release, so nothing is published. */
  status: ImportStatus | "preview" | "unchanged";
  importId: string | null;
  reasons: string[];
  providers: string[];
  summary: { added: number; removed: number; up: number; down: number; modified: number };
  rejected: RejectedRow[];
  report: string;
}

export interface ImportLogEntry {
  at: string;
  importId: string | null;
  status: ImportOutcome["status"];
  source: ReleaseMeta["source"];
  files: string[];
  providers: string[];
  summary: ImportOutcome["summary"];
  reasons: string[];
}

export interface ImportOptions {
  source: "api" | "inbox";
  force?: boolean;
  dryRun?: boolean;
}

let lastStamp = 0;

/**
 * Release id that sorts chronologically: UTC time to the millisecond, strictly increasing
 * within the process (two imports in the same millisecond still get ordered ids), plus a
 * short random suffix.
 */
export function newImportId(now = new Date()): string {
  const ms = Math.max(now.getTime(), lastStamp + 1);
  lastStamp = ms;
  const stamp = new Date(ms).toISOString().replace(/[-:.]/g, "");
  return `${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}

export class DataStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly dir: string,
    private readonly options: {
      seedDir?: string;
      keep?: number;
      guard?: GuardConfig;
      /** How long to wait for another process (the CLI, a second server) to release the lock. */
      lockTimeoutMs?: number;
    } = {},
  ) {}

  get releasesDir() {
    return join(this.dir, "releases");
  }
  get inboxDir() {
    return join(this.dir, "inbox");
  }
  get currentLink() {
    return join(this.dir, "current");
  }

  /** Creates the layout and, on an empty volume, publishes the seed files as the first release. */
  init(): void {
    mkdirSync(this.releasesDir, { recursive: true });
    mkdirSync(this.inboxDir, { recursive: true });
    this.withLock(() => this.seed());
  }

  private seed(): void {
    if (this.currentId() || !this.options.seedDir) return;
    this.publishSeed();
  }

  private publishSeed(): string {
    const dir = this.options.seedDir;
    if (!dir) throw new Error("no seed directory");
    const seed = readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".csv"))
      .sort()
      .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }));
    const plan = planImport([], seed, { force: true });
    if (plan.status !== "published")
      throw new Error(`seed data is invalid: ${plan.reasons.join(" ")}`);
    const importId = newImportId();
    this.writeRelease(plan, {
      importId,
      importedAt: new Date().toISOString(),
      previousImportId: null,
      source: "seed",
    });
    return importId;
  }

  /**
   * Back to the seed files, history forgotten: the sandbox's nightly reset. The seed is published
   * as a new release before the old ones go, so readers never see an empty volume.
   */
  reset(): Promise<string> {
    const run = this.queue.then(() =>
      this.withLock(() => {
        const importId = this.publishSeed();
        for (const d of readdirSync(this.releasesDir)) {
          if (!d.startsWith(".") && d !== importId)
            rmSync(join(this.releasesDir, d), { recursive: true, force: true });
        }
        rmSync(join(this.dir, "imports.jsonl"), { force: true });
        return importId;
      }),
    );
    this.queue = run.catch(() => {});
    return run;
  }

  currentId(): string | null {
    try {
      return basename(readlinkSync(this.currentLink));
    } catch {
      return null;
    }
  }

  currentFiles(): SupplierFile[] {
    const id = this.currentId();
    if (!id) return [];
    const dir = join(this.releasesDir, id, "csv");
    return readdirSync(dir)
      .sort()
      .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }));
  }

  /**
   * Imports are serialized: in-process by a queue, across processes (server and CLI on the
   * same volume) by a lock directory, so two uploads never race on the same release.
   */
  import(uploaded: SupplierFile[], options: ImportOptions): Promise<ImportOutcome> {
    const run = this.queue.then(() => this.withLock(() => this.importNow(uploaded, options)));
    this.queue = run.catch(() => {});
    return run;
  }

  history(limit = 20): ImportLogEntry[] {
    const log = join(this.dir, "imports.jsonl");
    if (!existsSync(log)) return [];
    return readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ImportLogEntry)
      .reverse()
      .slice(0, limit);
  }

  /** mkdir is atomic: whoever creates `.lock` owns the volume; a lock older than 2 min is stale. */
  private withLock<T>(fn: () => T): T {
    const lock = join(this.dir, ".lock");
    const deadline = Date.now() + (this.options.lockTimeoutMs ?? 30_000);
    for (;;) {
      try {
        mkdirSync(lock);
        break;
      } catch {
        try {
          if (Date.now() - statSync(lock).mtimeMs > 120_000) rmdirSync(lock);
        } catch {}
        if (Date.now() > deadline)
          throw new Error("volume verrouillé par un autre import, réessayez");
        Bun.sleepSync(50);
      }
    }
    try {
      return fn();
    } finally {
      rmdirSync(lock);
    }
  }

  private importNow(uploaded: SupplierFile[], options: ImportOptions): ImportOutcome {
    const previousImportId = this.currentId();
    const plan = planImport(this.currentFiles(), uploaded, {
      force: options.force,
      guard: this.options.guard,
    });
    const up = plan.diff.repriced.filter((c) => c.after.price > c.before.price).length;
    const same = plan.status === "published" && !hasChanges(plan.diff);
    const outcome: ImportOutcome = {
      status: same
        ? "unchanged"
        : options.dryRun && plan.status === "published"
          ? "preview"
          : plan.status,
      importId: null,
      reasons: plan.reasons,
      providers: plan.providers,
      summary: {
        added: plan.diff.added.length,
        removed: plan.diff.removed.length,
        up,
        down: plan.diff.repriced.length - up,
        modified: plan.diff.modified.length,
      },
      rejected: plan.quality.rejected,
      report: plan.report,
    };
    if (same)
      outcome.reasons = ["Fichier identique au catalogue en ligne : aucune nouvelle release."];
    if (options.dryRun) return outcome;
    if (outcome.status === "published") {
      outcome.importId = newImportId();
      this.writeRelease(plan, {
        importId: outcome.importId,
        importedAt: new Date().toISOString(),
        previousImportId,
        source: options.source,
      });
    }
    this.log({
      at: new Date().toISOString(),
      importId: outcome.importId,
      status: outcome.status,
      source: options.source,
      files: uploaded.map((f) => f.file),
      providers: outcome.providers,
      summary: outcome.summary,
      reasons: outcome.reasons,
    });
    return outcome;
  }

  private writeRelease(plan: ReturnType<typeof planImport>, meta: ReleaseMeta): void {
    // Write everything in a hidden staging directory, then rename and swap the symlink:
    // readers see either the old release or the new one, never a half-written mix.
    const staging = join(this.releasesDir, `.staging-${meta.importId}`);
    mkdirSync(join(staging, "csv"), { recursive: true });
    for (const f of plan.files) writeFileSync(join(staging, "csv", f.file), f.text);
    for (const [name, body] of Object.entries(releaseArtifacts(plan, meta))) {
      writeFileSync(join(staging, name), JSON.stringify(body));
    }
    writeFileSync(join(staging, "report.md"), plan.report);
    const target = join(this.releasesDir, meta.importId);
    renameSync(staging, target);
    const tmpLink = join(this.dir, `.current-${meta.importId}`);
    symlinkSync(join("releases", meta.importId), tmpLink);
    renameSync(tmpLink, this.currentLink);
    this.prune();
  }

  private prune(): void {
    const keep = this.options.keep ?? 30;
    const current = this.currentId();
    const all = readdirSync(this.releasesDir)
      .filter((d) => !d.startsWith("."))
      .sort();
    for (const d of all.slice(0, Math.max(0, all.length - keep))) {
      if (d !== current) rmSync(join(this.releasesDir, d), { recursive: true, force: true });
    }
  }

  private log(entry: ImportLogEntry): void {
    appendFileSync(join(this.dir, "imports.jsonl"), `${JSON.stringify(entry)}\n`);
  }
}
