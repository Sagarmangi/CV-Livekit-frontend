import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Outfit, Unbounded } from "next/font/google";

import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

/*
 * The four faces from the Kodexo Labs visual identity (SOT §2), self-hosted by
 * next/font. Each exposes a CSS variable that globals.css points the SOT's own
 * `--font-*` tokens at.
 *
 * Unbounded carries H1 only, so it ships one weight rather than the full
 * variable range. Outfit stands in for Bernabeu, which isn't a Google face --
 * that substitution is the SOT's own documented fallback.
 */
const displayFont = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["900"],
});

const headingFont = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kodexo Voice Agent Dashboard",
  description:
    "Configure voice agents, manage Twilio numbers, and review call logs.",
};

/**
 * Every screen here reads live state — agent config from Supabase, numbers from
 * the Twilio API. Without this, Next prerenders these routes at build time and
 * an admin sees a snapshot taken before the credentials even existed. Route
 * segment config cascades, so this covers all child routes.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The theme script below sets data-theme on this element before React
      // hydrates. Nothing here renders that attribute, so there's no value for
      // React to disagree with -- this only silences the warning about the
      // attribute existing at all.
      suppressHydrationWarning
      className={`${displayFont.variable} ${headingFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-body text-body">
        {/* First thing in the document, and synchronous: it has to resolve the
            theme before the browser paints, or every load flashes light before
            settling. See lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
