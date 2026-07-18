"use client"

// Wordmark animé « Ledger Draw » : au montage, les trois filets du registre se
// tracent de gauche à droite (scaleX 0→1, origine gauche), le filet vert en
// dernier. Composant client dédié — le RantiLogo statique reste un composant
// serveur pour tous les autres écrans (reçus, /verifier, app-shell…).
// Rejoue quand `playKey` change. Coupé sous prefers-reduced-motion.
import { useEffect, useRef } from "react"

// Ordre de tracé = ordre des délais : haut (50 ms), bas (280 ms), vert (500 ms).
const DRAW = [
  { y: 10, w: 16, fill: "#f7f7f2", delay: 50 }, // filet haut
  { y: 20, w: 8, fill: "#f7f7f2", delay: 280 }, // filet bas
  { y: 15, w: 12, fill: "#94f27f", delay: 500 }, // filet vert (feuille) — en dernier
]

export function RantiWordmark({
  size = 30,
  animate = true,
  playKey = 0,
  showText = true,
}: {
  size?: number
  animate?: boolean
  playKey?: number
  showText?: boolean
}) {
  const rects = useRef<(SVGRectElement | null)[]>([])

  useEffect(() => {
    if (!animate) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const anims = rects.current.map((r, i) =>
      r?.animate(
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        { duration: 500, delay: DRAW[i].delay, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "backwards" },
      ),
    )
    return () => anims.forEach((a) => a?.cancel())
  }, [animate, playKey])

  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#292929" />
        {DRAW.map((d, i) => (
          <rect
            key={d.y}
            ref={(el) => {
              rects.current[i] = el
            }}
            x="8"
            y={d.y}
            width={d.w}
            height="2.6"
            rx="1.3"
            fill={d.fill}
            style={{ transformBox: "fill-box", transformOrigin: "left center" }}
          />
        ))}
      </svg>
      {showText && (
        <span className="font-display text-xl font-extrabold tracking-tight text-ink-title">Ranti</span>
      )}
    </span>
  )
}
