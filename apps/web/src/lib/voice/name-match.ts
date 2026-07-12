// Garde-fou anti-hallucination de la saisie vocale (ADR-012). Gemini peut
// mapper un nom absent de la base vers un bail existant (surtout s'il n'y en a
// qu'un). On exige qu'au moins un token du nom entendu recoupe le locataire du
// bail résolu ; sans recoupement, la résolution est rejetée et l'utilisateur
// choisit le bail à la main — jamais de quittance pour le mauvais locataire.

// Normalise un nom pour comparaison : minuscules, sans accents, tokens alpha.
export function nameTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
}

export function hintMatchesTenant(hint: string, tenantName: string): boolean {
  const hintTokens = nameTokens(hint)
  if (hintTokens.length === 0) return true // pas de nom entendu : rien à réfuter
  const tenantSet = new Set(nameTokens(tenantName))
  return hintTokens.some((t) => tenantSet.has(t))
}
