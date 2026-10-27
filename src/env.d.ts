// Custom hydration directive registered in astro.config.mjs (src/directives/afterpaint.ts).
declare namespace Astro {
  interface ClientDirectives {
    "client:afterpaint"?: boolean;
  }
}
