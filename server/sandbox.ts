import type { DataStore } from "./store";

const STEP_MS = 15 * 60_000;

/**
 * Milliseconds from `now` to the next `hour`:00 in `timeZone`. Steps of 15 minutes over the next
 * two days, read with Intl: correct on daylight saving days and in zones with half-hour offsets.
 */
export function msUntilNext(now: Date, hour: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const first = Math.ceil((now.getTime() + 1) / STEP_MS) * STEP_MS;
  for (let t = first; t <= now.getTime() + 2 * 86_400_000; t += STEP_MS) {
    const p = Object.fromEntries(parts.formatToParts(t).map((x) => [x.type, x.value]));
    if (Number(p.hour) === hour && Number(p.minute) === 0) return t - now.getTime();
  }
  throw new Error(`no ${hour}:00 in ${timeZone} within two days`);
}

export interface ResetSchedule {
  /** Local hour of the nightly reset. */
  hour: number;
  timeZone: string;
  /** Fixed interval instead of the nightly schedule: tests and oracles only. */
  everyMs?: number;
  onReset?: (importId: string) => void;
}

/** Resets the sandbox store every night (or every `everyMs`). Returns a function that stops it. */
export function scheduleResets(store: DataStore, schedule: ResetSchedule): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const arm = () => {
    if (stopped) return;
    const delay = schedule.everyMs ?? msUntilNext(new Date(), schedule.hour, schedule.timeZone);
    timer = setTimeout(async () => {
      try {
        schedule.onReset?.(await store.reset());
      } catch (e) {
        console.error("sandbox reset failed:", e);
      }
      arm();
    }, delay);
  };
  arm();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
