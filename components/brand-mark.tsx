import Image from "next/image";

/**
 * The Kodexo Labs mark. The asset is already brand red on transparency, so it
 * sits directly on whatever surface it's placed on -- no coloured tile behind
 * it, which would double up the red and fight the identity's "one red accent"
 * rule.
 *
 * The same file is `app/icon.png`, which is where the browser tab icon comes
 * from via Next's file convention.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/kodexo-mark.png"
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
const WORDMARK_RATIO = 529 / 180;

/**
 * The full Kodexo Labs logo, artwork rather than set type -- so the wordmark is
 * always the real one instead of an approximation in whatever face is loaded.
 *
 * Two files, swapped by CSS rather than by reading the theme in JS: the artwork
 * is flat black in one and flat white in the other, so neither survives both
 * backgrounds. `dark:` here resolves through the `data-theme="dark"` custom
 * variant in globals.css, which means the right one is correct in the very first
 * paint -- a JS-chosen src would flash the wrong colour on load, and it would be
 * the *invisible* one against its own background.
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
        alt="Kodexo Labs"
        src="/kodexo-labs-logo-light.png"
        className="shrink-0 dark:hidden"
      />
      <Image
        {...size}
        alt="Kodexo Labs"
        src="/kodexo-labs-logo-dark.png"
        className="hidden shrink-0 dark:block"
      />
    </>
  );
}
