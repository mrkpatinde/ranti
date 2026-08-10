import type { Metadata } from "next";
import Landing from "./_components/landing";

export const metadata: Metadata = {
  // Canonique explicite -> apex. Coupe court au dédoublonnage http/www/apex de
  // Google (Search Console). metadataBase (layout racine) la résout en absolu.
  alternates: { canonical: "/" },
  description:
    "Ranti clôture le mois des entreprises de gestion immobilière au Bénin : importez votre portefeuille, suivez les encaissements, relancez par lot et remettez à chaque mandant son relevé PDF.",
};

export default function Home() {
  return <Landing />;
}
