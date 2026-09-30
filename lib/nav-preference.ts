/**
 * Whether the primary nav rail is collapsed, shared between the layout that
 * reads the cookie server-side and the rail that writes it in the browser.
 *
 * A cookie rather than localStorage specifically so the first server render
 * already knows the width -- see the note in components/app-sidebar.tsx.
 */
export const NAV_COLLAPSED_COOKIE = "kodexo-nav-collapsed";
