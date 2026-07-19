import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plusieurs lockfiles présents sur la machine : fixer la racine du
  // monorepo pour éviter que Turbopack surveille tout le home.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  experimental: {
    // Cache client des pages dynamiques : revenir sur un onglet visité il y a
    // moins de 30 s réutilise le rendu en cache, navigation instantanée sans
    // requête. Les server actions purgent ce cache via revalidatePath sur
    // toutes les surfaces du flux argent. Limites assumées (30 s de retard au
    // pire, contre un refetch systématique avant) : les écritures EXTERNES à
    // la session (webhook FeexPay, actions locataire côté public, envois
    // ranti-ops) ne peuvent pas purger le cache du navigateur du
    // propriétaire ; et le cache est PAR ONGLET, une écriture dans l'onglet A
    // ne purge pas un onglet B ouvert sur la même session.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
