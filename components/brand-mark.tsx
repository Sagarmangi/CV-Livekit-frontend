import Image from "next/image";

/**
 * The Codeora Vision mark. The asset is full-colour artwork on transparency, so
 * it sits directly on whatever surface it's placed on -- no coloured tile
 * behind it.
 *
 * `app/icon.png` and `app/favicon.ico` are generated from the same file, which
 * is where the browser tab icon comes from via Next's file convention.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/codeora-vision-mark.png"
      alt=""
      width={size}
      height={size}
      // Nav and sign-in chrome -- always above the fold, so it should never
      // wait for the lazy-loading observer.
      priority
      className="shrink-0"
    />
  );
}

// Both logo files are the same artwork; this is its aspect ratio, so a caller
// only ever picks a height and can't distort it.
const WORDMARK_RATIO = 1515 / 390;

/**
 * The full Codeora Vision logo, artwork rather than set type -- so the wordmark
 * is always the real one instead of an approximation in whatever face is loaded.
 *
 * Two files, swapped by CSS rather than by reading the theme in JS: the lettering
 * is dark in one and white in the other, so neither survives both backgrounds.
 * `-on-light` is the dark-lettered file for the light theme, `-on-dark` the
 * white-lettered one. `dark:` here resolves through the `data-theme="dark"`
 * custom variant in globals.css, which means the right one is correct in the
 * very first paint -- a JS-chosen src would flash the wrong colour on load, and
 * it would be the *invisible* one against its own background.
 *
 * Only the displayed image is in the accessibility tree; the other is
 * `display: none`, so both can carry the same alt text without it being read
 * twice.
 */
export function BrandWordmark({ height = 36 }: { height?: number }) {
  const width = Math.round(height * WORDMARK_RATIO);
  // `alt` is repeated on each rather than spread in: the jsx-a11y rule reads the
  // JSX statically and can't see a prop arriving through an object spread, so
  // spreading it means a lint warning on artwork that is in fact labelled.
  const size = { width, height, priority: true } as const;
  return (
    <>
      <Image
        {...size}
        alt="Codeora Vision"
        src="/codeora-vision-logo-on-light.png"
        className="shrink-0 dark:hidden"
      />
      <Image
        {...size}
        alt="Codeora Vision"
        src="/codeora-vision-logo-on-dark.png"
        className="hidden shrink-0 dark:block"
      />
    </>
  );
}
