import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// Brand fonts: Bricolage Grotesque for the logo/headings, Space Grotesk for UI text.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Handwriting for the pin description on its torn binder-paper note.
const caveat = Caveat({
  variable: "--font-handwriting",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wandering Pins",
  description: "Every pin has a journey. Scan the code on the back to see where it's been.",
};

export const viewport: Viewport = {
  themeColor: "#17323D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${spaceGrotesk.variable} ${caveat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
