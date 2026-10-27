import { afterEach, beforeEach, expect, test } from "bun:test";
import afterPaint, { MAX_WAIT_MS } from "./afterpaint";

type Callback = (
  list: { getEntriesByName(name: string): unknown[] },
  o: { disconnect(): void },
) => void;
const real = globalThis.PerformanceObserver;
let observers: { cb: Callback; options: unknown; disconnected: boolean }[] = [];

beforeEach(() => {
  observers = [];
  globalThis.PerformanceObserver = class {
    entry: (typeof observers)[number];
    constructor(cb: Callback) {
      this.entry = { cb, options: null, disconnected: false };
      observers.push(this.entry);
    }
    observe(options: unknown) {
      this.entry.options = options;
    }
  } as unknown as typeof PerformanceObserver;
});
afterEach(() => {
  globalThis.PerformanceObserver = real;
});

/** Fires the observer with the paint entries named. */
const paint = (...names: string[]) => {
  const o = observers[0];
  o.cb(
    { getEntriesByName: (n) => names.filter((x) => x === n) },
    {
      disconnect: () => {
        o.disconnected = true;
      },
    },
  );
};

function island() {
  const steps: string[] = [];
  const load = async () => {
    steps.push("load");
    return async () => {
      steps.push("hydrate");
    };
  };
  afterPaint(load, { name: "afterpaint", value: "" }, {} as HTMLElement);
  return steps;
}

test("hydrates only after the first contentful paint is reported, once", async () => {
  const steps = island();
  expect(observers[0].options).toEqual({ type: "paint", buffered: true });
  await Bun.sleep(5);
  expect(steps).toEqual([]);
  paint("first-paint"); // a background colour is not content yet
  await Bun.sleep(5);
  expect(steps).toEqual([]);
  paint("first-contentful-paint");
  await Bun.sleep(5);
  expect(steps).toEqual(["load", "hydrate"]);
  expect(observers[0].disconnected).toBe(true);
});

test(
  "hydrates anyway after the longest wait, e.g. in a background tab",
  async () => {
    const steps = island();
    await Bun.sleep(MAX_WAIT_MS + 50);
    expect(steps).toEqual(["load", "hydrate"]);
    paint("first-contentful-paint");
    await Bun.sleep(5);
    expect(steps).toEqual(["load", "hydrate"]); // not twice
  },
  MAX_WAIT_MS + 2000,
);

test(
  "without paint timing, the timeout still hydrates",
  async () => {
    globalThis.PerformanceObserver = class {
      observe() {
        throw new TypeError("type 'paint' is not supported");
      }
    } as unknown as typeof PerformanceObserver;
    const steps = island();
    await Bun.sleep(MAX_WAIT_MS + 50);
    expect(steps).toEqual(["load", "hydrate"]);
  },
  MAX_WAIT_MS + 2000,
);
