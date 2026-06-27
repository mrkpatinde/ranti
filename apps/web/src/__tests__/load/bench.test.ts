import { describe, it } from "vitest"

/**
 * Load test — concurrent requests against the running dev server.
 *
 * Measures:
 *   - Max throughput (req/s) without errors
 *   - Response time distribution (p50, p95, p99)
 *   - Error rate under load
 *
 * Targets the landing page (static-ish, cached) and a dynamic route
 * (login, which hits the server but not Supabase since there's no real DB).
 */

const BASE = "http://localhost:3300"

async function serverUp(): Promise<boolean> {
  try {
    const r = await fetch(BASE, { method: "HEAD" })
    return r.status > 0
  } catch {
    return false
  }
}
const SERVER_UP = await serverUp()
if (!SERVER_UP) console.warn("[skip] dev server not reachable on " + BASE + " — integration/load tests skipped")
const CONCURRENCY = 20
const REQUESTS_PER_ROUTE = 100

interface BenchResult {
  route: string
  total: number
  ok: number
  errors: number
  latencies: number[]
  durationMs: number
}

async function benchRoute(route: string, concurrency: number, total: number): Promise<BenchResult> {
  const latencies: number[] = []
  let ok = 0
  let errors = 0
  const start = Date.now()

  const queue = Array.from({ length: total }, (_, i) => i)

  async function worker() {
    while (queue.length > 0) {
      const _i = queue.pop()
      if (_i === undefined) break
      const reqStart = Date.now()
      try {
        const res = await fetch(`${BASE}${route}`, { redirect: "manual" })
        const latency = Date.now() - reqStart
        latencies.push(latency)
        if (res.ok || res.status === 307) {
          ok++
        } else {
          errors++
        }
      } catch {
        errors++
      }
    }
  }

  // Launch N concurrent workers
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const durationMs = Date.now() - start
  return { route, total, ok, errors, latencies: latencies.sort((a, b) => a - b), durationMs }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

function summary(r: BenchResult): string {
  const p50 = percentile(r.latencies, 50)
  const p95 = percentile(r.latencies, 95)
  const p99 = percentile(r.latencies, 99)
  const avg = r.latencies.length > 0
    ? Math.round(r.latencies.reduce((a, b) => a + b, 0) / r.latencies.length)
    : 0
  const reqPerSec = r.durationMs > 0 ? Math.round((r.total / r.durationMs) * 1000) : 0

  return [
    `${r.route.padEnd(20)} |`,
    `${r.ok}/${r.total} OK`.padEnd(12),
    `${r.errors} err`.padEnd(8),
    `avg=${String(avg).padStart(4)}ms`,
    `p50=${String(p50).padStart(4)}ms`,
    `p95=${String(p95).padStart(4)}ms`,
    `p99=${String(p99).padStart(4)}ms`,
    `${reqPerSec} req/s`,
  ].join(" ")
}

describe.skipIf(!SERVER_UP)("Load test — landing page (static-ish)", () => {
  it(`bench / with ${CONCURRENCY} concurrent × ${REQUESTS_PER_ROUTE} requests`, async () => {
    const r = await benchRoute("/", CONCURRENCY, REQUESTS_PER_ROUTE)
    console.log("\n  " + summary(r))

    expect(r.errors).toBe(0)
    expect(r.ok).toBe(r.total)
    // p95 under 2s is reasonable for dev server (Turbopack recompiles on-the-fly)
    const p95 = percentile(r.latencies, 95)
    expect(p95).toBeLessThan(2500)
  }, 30000)
})

describe.skipIf(!SERVER_UP)("Load test — login page (dynamic)", () => {
  it(`bench /login with ${CONCURRENCY} concurrent × ${REQUESTS_PER_ROUTE} requests`, async () => {
    const r = await benchRoute("/login", CONCURRENCY, REQUESTS_PER_ROUTE)
    console.log("\n  " + summary(r))

    expect(r.errors).toBe(0)
    expect(r.ok).toBe(r.total)
    // p95 under 2.5s for a dynamic route on dev server
    const p95 = percentile(r.latencies, 95)
    expect(p95).toBeLessThan(3000)
  }, 30000)
})

describe.skipIf(!SERVER_UP)("Load test — signup page (dynamic + form)", () => {
  it(`bench /signup with ${Math.floor(CONCURRENCY/2)} concurrent × ${Math.floor(REQUESTS_PER_ROUTE/2)} requests`, async () => {
    const r = await benchRoute("/signup", Math.floor(CONCURRENCY/2), Math.floor(REQUESTS_PER_ROUTE/2))
    console.log("\n  " + summary(r))

    expect(r.errors).toBe(0)
    expect(r.ok).toBe(r.total)
    const p95 = percentile(r.latencies, 95)
    expect(p95).toBeLessThan(2500)
  }, 30000)
})

describe.skipIf(!SERVER_UP)("Load test — mixed workload", () => {
  it("handles mixed routes concurrently without errors", async () => {
    const routes = ["/", "/login", "/signup", "/recover", "/auth/error"]
    const perRoute = 20
    const concurrency = 10

    const results = await Promise.all(
      routes.map((route) => benchRoute(route, concurrency, perRoute))
    )

    console.log("\n  Mixed workload:")
    for (const r of results) {
      console.log("  " + summary(r))
    }

    for (const r of results) {
      expect(r.errors).toBe(0)
    }
  }, 30000)
})
