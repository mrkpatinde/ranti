"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, ExternalLink, X } from "lucide-react"
import { buttonClasses } from "@/components/ui/button"
import {
  SUPPORT_EMAIL_URL,
  SUPPORT_NOTION_URL,
  SUPPORT_WHATSAPP_URL,
} from "@/lib/support"

// Centre d'aide (handoff FirstRun) : un bouton « Centre d'aide » dans la barre
// latérale / le menu mobile ouvre la modale « Aide Ranti » — guides du centre
// d'aide Notion, plus les canaux directs (WhatsApp, email) en repli. Le support
// WhatsApp arrive plus tard ; le centre d'aide Notion est le canal principal.
//
// L'URL Notion (SUPPORT_NOTION_URL) est facultative : sans elle, on n'affiche
// pas les liens vers le centre d'aide (même parti pris que le lien WhatsApp) —
// la modale reste utile via email / WhatsApp.
const GUIDES = [
  "Créer votre premier bail",
  "Valider un paiement et éditer la quittance",
  "Programmer les relances",
]

export function HelpCenter({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false)
  // Const local : préserve le narrowing string dans la closure du .map (un
  // const de module ne se rétrécit pas dans une fonction imbriquée).
  const notionUrl = SUPPORT_NOTION_URL
  // Focus a11y (aria-modal) : à l'ouverture, on porte le focus sur « Fermer » ;
  // à la fermeture, on le rend à l'élément déclencheur (mémorisé à l'ouverture).
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = (document.activeElement as HTMLElement) ?? null
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      restoreRef.current?.focus?.()
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block w-full rounded-lg px-3.5 py-3 text-left text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground ${className}`}
      >
        Centre d&apos;aide
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-center-title"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="lp-rise w-full max-w-[420px] overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_1px_2px_rgba(41,41,41,0.06),0_24px_60px_-24px_rgba(41,41,41,0.35)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 pb-4 pt-6">
              <div className="space-y-1">
                <h2
                  id="help-center-title"
                  className="font-display text-xl font-extrabold tracking-tight text-foreground"
                >
                  Aide Ranti
                </h2>
                <p className="text-sm text-muted-foreground">
                  Guides et réponses en français, dans le centre d&apos;aide.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-6">
              {notionUrl ? (
                <>
                  <div className="flex flex-col overflow-hidden rounded-2xl border border-border">
                    {GUIDES.map((guide, i) => (
                      <a
                        key={guide}
                        href={notionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:bg-secondary ${
                          i > 0 ? "border-t border-border" : ""
                        }`}
                      >
                        {guide}
                        <ChevronRight
                          size={14}
                          strokeWidth={1.8}
                          className="flex-shrink-0 text-muted-foreground"
                        />
                      </a>
                    ))}
                  </div>

                  <a
                    href={notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses("primary", "gap-2")}
                  >
                    Ouvrir le centre d&apos;aide
                    <ExternalLink size={15} strokeWidth={1.8} />
                  </a>
                </>
              ) : null}

              <div className="flex flex-col gap-1">
                {SUPPORT_WHATSAPP_URL ? (
                  <a
                    href={SUPPORT_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-3.5 py-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                  >
                    WhatsApp Ranti
                  </a>
                ) : null}
                <a
                  href={SUPPORT_EMAIL_URL}
                  className="rounded-lg px-3.5 py-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                >
                  Écrire un email
                </a>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Le support WhatsApp arrive bientôt — en attendant, toutes les
                réponses sont dans le centre d&apos;aide.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
