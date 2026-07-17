// #167 Phase 1 — clé d'idempotence des écritures critiques.
// Le formulaire embarque un UUID généré à son rendu (champ caché request_id) ;
// la RPC ne rejoue jamais deux fois la même clé (public.idempotency_keys).
// Une clé absente ou malformée est ignorée (null) : l'écriture reste valide,
// simplement non protégée — jamais bloquante.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readRequestId(formData: FormData): string | null {
  const value = formData.get("request_id")
  return typeof value === "string" && UUID_RE.test(value.trim()) ? value.trim() : null
}
