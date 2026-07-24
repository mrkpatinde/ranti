import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Pages publiques indexables uniquement : landing + pages légales. Les surfaces
// privées (espace connecté, reçus par jeton nominatifs) sont hors sitemap et
// bloquées côté robots.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/a-propos", "/conditions", "/confidentialite"]
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.5,
  }))
}
