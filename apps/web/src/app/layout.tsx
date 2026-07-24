import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import { AxeptioConsent } from "@/components/axeptio";
import { OfflineBanner } from "@/components/offline-banner";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

// Ranti brand type: Fraunces (display serif, headings/prices/wordmark) +
// Hanken Grotesk (body/labels/buttons) — the same fonts as the production
// brand system (see project/_ds/.../tokens/fonts.css in the design handoff).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Base des URLs absolues (canonique, OG). Apex sans www, figé (voir lib/site).
  metadataBase: new URL(SITE_URL),
  title: "Ranti — Le registre de loyer des propriétaires africains",
  description:
    "Suivez vos loyers sans effort : relances prêtes au bon moment, quittances numérotées que votre locataire confirme et que tout le monde peut vérifier d'un lien.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${hankenGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SwRegister />
        <OfflineBanner />
        {children}
        <AxeptioConsent />
      </body>
    </html>
  );
}
