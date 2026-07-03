// Marque Ranti : trois lignes de registre dégressives, la médiane barrée en orange.
// Seule source du logo — ne pas redessiner de variante locale.
export function RantiLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#163828" />
      <rect x="8" y="10" width="16" height="2.6" rx="1.3" fill="#faf3e5" />
      <rect x="8" y="15" width="12" height="2.6" rx="1.3" fill="#f2a33c" />
      <rect x="8" y="20" width="8" height="2.6" rx="1.3" fill="#faf3e5" />
    </svg>
  )
}
