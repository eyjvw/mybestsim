import { providerInitials, providerLogo } from "../lib/logos";

interface Props {
  provider: string;
  /** Rendered size in px; the files are 64 px, sharp up to a 3x screen at 20 px. */
  size?: 16 | 20;
  /** Spacing when the logo sits inline in a line of text. */
  className?: string;
}

/**
 * Decorative: the provider's name is always printed next to it, so the logo has an empty alt.
 * Without a logo file, the initials come from CSS (attr), so they add no text to the page.
 */
export function ProviderLogo({ provider, size = 20, className = "" }: Props) {
  const src = providerLogo(provider);
  const box = `${size === 16 ? "size-4 rounded-[4px]" : "size-5 rounded-[5px]"} ${className}`;
  if (src)
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        data-logo={provider}
        className={`${box} inline-block shrink-0 bg-white align-middle ring-1 ring-line`}
      />
    );
  return (
    <span
      aria-hidden="true"
      data-logo={provider}
      data-initials={providerInitials(provider)}
      className={`${box} inline-grid shrink-0 place-items-center bg-surface-2 align-middle text-[9px] leading-none font-semibold text-ink-2 ring-1 ring-line before:content-[attr(data-initials)]`}
    />
  );
}
