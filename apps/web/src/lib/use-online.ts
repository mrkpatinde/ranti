"use client"

// #167 Phase 2 — état réseau du navigateur, côté client uniquement.
// useSyncExternalStore : abonnement aux événements online/offline, snapshot
// serveur « en ligne » (le SSR ne connaît pas le réseau du téléphone ; la
// valeur réelle arrive à l'hydratation, sans mismatch).
import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  return true
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
