"use client"

// #167 Phase 3 — enregistrement du service worker (lecture hors connexion).
// Production uniquement ; en dev on désenregistre activement pour ne jamais
// déboguer contre un cache fantôme.
import { useEffect } from "react"

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => {
        for (const r of rs) r.unregister()
      })
      return
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("sw: registration failed", err)
    })
  }, [])

  return null
}
