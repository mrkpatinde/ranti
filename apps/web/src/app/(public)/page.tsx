import type { Metadata } from "next";
import Landing from "./_components/landing";

export const metadata: Metadata = {
  // Canonique explicite -> apex. Coupe court au dédoublonnage http/www/apex de
  // Google (Search Console). metadataBase (layout racine) la résout en absolu.
  alternates: { canonical: "/" },
  description:
    "Ranti, le registre de loyer des propriétaires africains : suivez qui a payé, relancez vos locataires à votre place et éditez vos quittances. Vous validez, c'est tout.",
};

export default function Home() {
  return <Landing />;
}
