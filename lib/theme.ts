/**
 * Light/dark theming, shared between the pre-paint script in the root layout
 * and the picker in the profile menu.
 *
 * The visual identity keys dark mode off `[data-theme="dark"]` on <html> (see
 * app/brand-tokens.css), so all either side has to agree on is the storage key
 * and what the three choices mean.
 */

export const THEME_STORAGE_KEY = "kodexo-theme";

export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/**
 * Runs blocking, before the first paint, from the root layout. Anything later
 * -- an effect, a client component's first render -- happens after the browser
 * has already painted, which is exactly the white-flash-then-dark that makes a
 * dashboard feel cheap.
 *
 * Deliberately dependency-free and defensive: localStorage throws outright in
 * some privacy modes, and a theme preference is not worth taking the whole page
 * down for.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var choice = stored === "light" || stored === "dark" ? stored : "system";
    var dark = choice === "dark" || (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

/** Resolves a choice to the attribute value and writes it to <html>. */
export function applyTheme(choice: ThemeChoice): void {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Preference just won't persist across reloads -- not worth surfacing.
  }
}
