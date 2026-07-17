import type { MetadataRoute } from "next"

// #167 Phase 3 — PWA installable SANS prompt in-app (décision CEO 2026-07-16) :
// le manifest suffit pour « Ajouter à l'écran d'accueil » via le menu du
// navigateur ; aucune bannière d'installation dans l'UI (sobriété DESIGN.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ranti — Registre de loyer",
    short_name: "Ranti",
    description:
      "Le registre de loyer des propriétaires africains : loyers suivis, relances au bon moment, quittances vérifiables.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f9f8f6",
    theme_color: "#f9f8f6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
