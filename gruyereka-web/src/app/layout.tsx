import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: {
    default: "Gruyereka",
    template: "%s · Gruyereka",
  },
  description:
    "Notez le fromage que vous avez acheté, et la boutique où vous l’avez acheté. Le jour, le prix au kilo, et rien qui s’efface.",
  icons: { icon: "/brand/logo.svg" },
  openGraph: {
    type: "website",
    siteName: "Gruyereka",
    locale: "fr_FR",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
