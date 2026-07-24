// ============================================================
// Service worker Ranti — PWA lecture hors connexion (#167 Phase 3).
//
// Promesse : le registre reste CONSULTABLE sur le terrain sans réseau —
// les dernières pages vues se rouvrent en avion. AUCUNE écriture hors
// ligne (les envois attendent le réseau, cf. SubmitButton Phase 2).
//
// Budget de cache (décision documentée, ADR-022 même esprit de sobriété) :
// - Statiques hashés (/_next/static, icônes) : cache-first — immuables.
// - Pages de consultation (navigations + payloads RSC) : network-first,
//   repli cache si hors ligne. Clé = pathname (les ?notice/?error ne
//   fragmentent pas le cache). Plafond ~50 entrées par cache, purge FIFO.
// - JAMAIS mis en cache : autre chose que GET, /api/*, /auth/*, /login,
//   /signup, les réponses non-200 et les redirections (ne pas figer une
//   page de login sous la clé du dashboard).
// - Un seul jeu de caches versionné : bump SW_VERSION → purge à l'activation.
// ============================================================

const SW_VERSION = "v1"
const STATIC_CACHE = `ranti-static-${SW_VERSION}`
const HTML_CACHE = `ranti-html-${SW_VERSION}`
const RSC_CACHE = `ranti-rsc-${SW_VERSION}`
const MAX_PAGE_ENTRIES = 50

// /verifier (recherche + verdicts) ne doit JAMAIS être servi depuis le cache :
// la clé de cache est le pathname seul, donc /verifier?ref=X écraserait l'entrée
// et un verdict mis en cache serait resservi hors-ligne pour n'importe quelle
// référence. Une surface de vérification échoue fermée, elle ne rejoue pas.
const NEVER_CACHE_PREFIXES = ["/api/", "/auth/", "/login", "/signup", "/recover", "/verifier"]

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((n) => ![STATIC_CACHE, HTML_CACHE, RSC_CACHE].includes(n))
          .map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/quittance-demo.png"
  )
}

function isNeverCached(url) {
  return NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))
}

// Copie la réponse en y ajoutant l'heure de mise en cache : le bandeau
// hors-ligne lit `sw-cached-at` pour afficher « données du … ».
async function withCachedAt(response) {
  const headers = new Headers(response.headers)
  headers.set("sw-cached-at", new Date().toISOString())
  const body = await response.clone().arrayBuffer()
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function trimCache(cacheName) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  // FIFO approximatif : keys() rend l'ordre d'insertion — on retire les plus anciennes.
  for (let i = 0; i < keys.length - MAX_PAGE_ENTRIES; i += 1) {
    await cache.delete(keys[i])
  }
}

// Network-first : la fraîcheur d'abord (un ledger ne montre pas du vieux quand
// le réseau est là) ; le cache n'est que le repli hors connexion.
async function pageNetworkFirst(event, cacheName, cacheKey) {
  try {
    const response = await fetch(event.request)
    if (response.ok && !response.redirected) {
      const cache = await caches.open(cacheName)
      await cache.put(cacheKey, await withCachedAt(response))
      event.waitUntil?.(trimCache(cacheName))
    }
    return response
  } catch (err) {
    const cached = await caches.match(cacheKey, { cacheName })
    if (cached) return cached
    throw err
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isNeverCached(url)) return

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: STATIC_CACHE })
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE)
          await cache.put(request, response.clone())
        }
        return response
      })(),
    )
    return
  }

  // Navigation complète (ouverture depuis l'écran d'accueil, reload).
  if (request.mode === "navigate") {
    event.respondWith(pageNetworkFirst(event, HTML_CACHE, url.pathname))
    return
  }

  // Navigation client Next (payload RSC) : même pathname, contenu différent —
  // cache séparé. On ignore les prefetchs spéculatifs (payloads partiels).
  if (request.headers.get("rsc") === "1") {
    if (request.headers.get("next-router-prefetch") === "1") return
    event.respondWith(pageNetworkFirst(event, RSC_CACHE, url.pathname))
    return
  }
})
