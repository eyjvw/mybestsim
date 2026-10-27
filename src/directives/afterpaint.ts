import type { ClientDirective } from "astro";

/** Longest wait for the first paint: a background tab, or a browser without paint timing. */
export const MAX_WAIT_MS = 2000;

/**
 * `client:afterpaint`: hydrates once the first contentful paint is on screen. The page is
 * rendered at build time with every figure, so the island's scripts (about 95 KB compressed) need
 * not compete with the first paint on a slow connection. The paint timing entry is reported once
 * the frame is presented, which a requestAnimationFrame callback cannot tell.
 */
const afterPaint: ClientDirective = (load) => {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    setTimeout(async () => {
      const hydrate = await load();
      await hydrate();
    });
  };
  try {
    new PerformanceObserver((list, observer) => {
      if (list.getEntriesByName("first-contentful-paint").length === 0) return;
      observer.disconnect();
      start();
    }).observe({ type: "paint", buffered: true });
  } catch {
    // No paint timing: the timeout below still hydrates.
  }
  setTimeout(start, MAX_WAIT_MS);
};

export default afterPaint;
