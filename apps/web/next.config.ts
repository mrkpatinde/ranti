import path from "node:path";
import type { NextConfig } from "next";

// Hôte canonique, aligné sur src/lib/site.ts : apex, sans www.
const CANONICAL_HOST = "monranti.com";

const nextConfig: NextConfig = {
  // Un seul hôte, pour une raison de session et non de référencement.
  //
  // Le parcours OAuth PKCE dépose un cookie « code verifier » sur l'hôte où il
  // démarre, et le relit sur l'hôte où il revient. Un aller depuis
  // www.monranti.com et un retour sur monranti.com laissent ce cookie
  // inaccessible : l'échange du code ne peut pas aboutir, aucune session n'est
  // créée, et l'utilisateur retombe sur la page d'accueil sans message. Il
  // recommence, et rien ne change — le symptôme observé le 9 août 2026.
  //
  // La redirection est posée avant tout le reste : le parcours ne peut plus
  // commencer sur un hôte et finir sur l'autre.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${CANONICAL_HOST}` }],
        destination: `https://${CANONICAL_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
  // Plusieurs lockfiles présents sur la machine : fixer la racine du
  // monorepo pour éviter que Turbopack surveille tout le home.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  experimental: {
    // Cache client des pages dynamiques : revenir sur un onglet visité il y a
    // moins de 30 s réutilise le rendu en cache, navigation instantanée sans
    // requête. Après une écriture d'argent, la server action appelle
    // revalidateMoneySurfaces() -> revalidatePath("/", "layout"), seul levier
    // qui purge de façon documentée ce cache client (voir lib/cache/money.ts).
    // Ne règle que `dynamic` : les surfaces argent sont dynamiques (auth par
    // cookie), donc bornées à 30 s. Le défaut `static` (5 min) ne vise que des
    // pages statiques/préchargées, hors flux argent.
    // Limites assumées (30 s de retard au pire) : les écritures EXTERNES à la
    // session (webhook FeexPay, actions locataire côté public, envois
    // ranti-ops) ne peuvent pas purger le cache du navigateur du propriétaire ;
    // et le cache est PAR ONGLET, une écriture dans l'onglet A ne purge pas un
    // onglet B ouvert sur la même session.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
