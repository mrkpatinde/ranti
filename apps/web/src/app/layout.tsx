import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
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
  title: "Ranti — Le registre de loyer des propriétaires africains",
  description:
    "Suivez vos loyers sans effort : relances prêtes au bon moment, quittances numérotées que votre locataire confirme et que tout le monde peut vérifier d'un lien.",
};

// Bascule auto en mode nuit (19 h–6 h locales) pour le confort visuel :
// pose la classe `.dark` sur <html> (tokens dans globals.css). La préférence
// système sombre reste gérée par prefers-color-scheme — on ne force JAMAIS
// le clair chez qui a choisi le sombre ; la nuit, on ajoute le sombre chez
// qui est resté en clair. Script inline exécuté avant le premier rendu
// (aucun flash clair la nuit), puis re-vérifié chaque minute si l'app
// reste ouverte au passage du soir.
const NIGHT_THEME_SCRIPT = `(function () {
  function apply() {
    var h = new Date().getHours();
    document.documentElement.classList.toggle("dark", h >= 19 || h < 6);
  }
  apply();
  setInterval(apply, 60000);
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${hankenGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: NIGHT_THEME_SCRIPT }} />
        <SwRegister />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
