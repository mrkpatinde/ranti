import { revalidatePath } from "next/cache"

// Purge après toute écriture d'argent (dashboard, encaissements, quittances,
// relances, journal, baux). Un seul levier, volontairement large.
//
// Pourquoi revalidatePath("/", "layout") et non une liste de chemins : le cache
// CLIENT (Router Cache, créé par staleTimes:30 dans next.config) n'est purgé de
// façon documentée QUE par revalidatePath("/", "layout") ("will purge the
// Client Cache", doc Next). Une liste de revalidatePath par chemin ne purge que
// les caches SERVEUR ; le refresh client observé aujourd'hui vient d'un effet
// global aux Server Actions que la doc annonce comme temporaire. Énumérer les
// surfaces ne protégerait donc PAS le cache client le jour où cet effet est
// restreint, alors que le levier racine, lui, reste correct. Il auto-couvre en
// prime toute nouvelle surface argent : rien à maintenir ici.
//
// Coût assumé : invalide aussi le cache des pages hors argent ; elles se
// recalculent au prochain passage. Acceptable pour un registre de loyer où la
// fraîcheur des montants prime sur la réutilisation du cache de navigation.
//
// NON-"use server" (fonction synchrone) : importé par les server actions, pas
// exposé comme action lui-même.
export function revalidateMoneySurfaces() {
  revalidatePath("/", "layout")
}
