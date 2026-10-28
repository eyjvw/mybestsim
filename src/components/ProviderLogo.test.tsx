import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderLogo } from "./ProviderLogo";

test("a known provider gets its logo file, decorative and sized", () => {
  const html = renderToStaticMarkup(<ProviderLogo provider="Maya Mobile" size={16} />);
  expect(html).toContain('src="/logos/mayamobile.webp"');
  expect(html).toContain('alt=""');
  expect(html).toContain('width="16"');
  expect(html).toContain('height="16"');
  expect(html).toContain('loading="lazy"');
});

test("a provider without a logo gets its initials from CSS, with no text in the page", () => {
  const html = renderToStaticMarkup(<ProviderLogo provider="Truphone" />);
  expect(html).not.toContain("<img");
  expect(html).toContain('data-initials="T"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toMatch(/<span[^>]*><\/span>/);
});
