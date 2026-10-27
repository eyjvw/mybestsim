// @ts-check

import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

/** `client:afterpaint`: hydrate an island just after the first paint (src/directives/afterpaint.ts). */
/** @type {import("astro").AstroIntegration} */
const afterPaint = {
  name: "client-afterpaint",
  hooks: {
    "astro:config:setup": ({ addClientDirective }) => {
      addClientDirective({
        name: "afterpaint",
        entrypoint: fileURLToPath(new URL("./src/directives/afterpaint.ts", import.meta.url)),
      });
    },
  },
};

export default defineConfig({
  site: "https://mybestsim.sbonneau.xyz",
  output: "static",
  integrations: [react(), afterPaint],
  // The stylesheet travels inside each page: no render-blocking request before the first paint.
  build: { inlineStylesheets: "always" },
  vite: { plugins: [tailwindcss()] },
});
