"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buttonClasses } from "@/components/ui/button"
import { formatFcfa } from "@/lib/format"
import { decodeSpreadsheetBytes, parseDelimited, type ParsedTable } from "@/lib/import/csv"
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_GROUPS,
  REQUIRED_FIELD_KEYS,
  importFieldLabel,
  type ImportFieldKey,
} from "@/lib/import/fields"
import { autoMapColumns, buildImportRows, localRowErrors } from "@/lib/import/mapping"
import { runPortfolioImport, validateImportRows } from "@/lib/import/actions"
import { buildTemplateCsv, TEMPLATE_FILE_NAME } from "@/lib/import/template"
import type { ImportRow, ImportSummary, ValidationLine } from "@/lib/import/types"
import { useOnline } from "@/lib/use-online"

type Step = "fichier" | "colonnes" | "apercu" | "termine"

const STEPS: { id: Step; label: string }[] = [
  { id: "fichier", label: "Fichier" },
  { id: "colonnes", label: "Colonnes" },
  { id: "apercu", label: "Aperçu" },
]

const cardClass = "rounded-2xl border border-border bg-card p-5"
const selectClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

// Au-delà, l'aperçu devient illisible sur mobile : on montre le début et on
// annonce le reste. Les lignes en erreur, elles, sont toutes affichées.
const PREVIEW_LIMIT = 25

function stepIndex(step: Step): number {
  const index = STEPS.findIndex((s) => s.id === step)
  return index === -1 ? STEPS.length : index
}

function StepBar({ step }: { step: Step }) {
  const current = stepIndex(step)

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {STEPS.map((item, index) => (
        <li key={item.id} className="flex items-center gap-2">
          {index > 0 ? <span className="text-muted-foreground">·</span> : null}
          <span
            aria-current={index === current ? "step" : undefined}
            className={
              index === current
                ? "font-medium text-foreground"
                : index < current
                  ? "text-foreground/60"
                  : "text-muted-foreground"
            }
          >
            {index + 1}. {item.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function rentLabel(row: ImportRow): string | null {
  if (!/^\d+$/.test(row.monthly_rent_amount)) return null
  return formatFcfa(Number.parseInt(row.monthly_rent_amount, 10))
}

function tenantLabel(row: ImportRow): string {
  const name = `${row.tenant_first_name} ${row.tenant_last_name}`.trim()
  return name === "" ? "Lot vacant" : name
}

export function ImportWizard() {
  const online = useOnline()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState<Step>("fichier")
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [source, setSource] = useState<string>("")
  const [mapping, setMapping] = useState<(ImportFieldKey | null)[]>([])
  const [paste, setPaste] = useState("")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [lines, setLines] = useState<ValidationLine[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Clé d'idempotence de la tentative : renouvelée à chaque nouvel aperçu, donc
  // stable tant que l'agence rejoue le MÊME import (double clic, reprise
  // réseau) — la base renvoie alors le récapitulatif d'origine.
  const requestId = useRef<string>("")

  const readyCount = useMemo(() => lines.filter((l) => l.errors.length === 0).length, [lines])
  const errorCount = lines.length - readyCount

  const missingRequired = REQUIRED_FIELD_KEYS.filter((key) => !mapping.includes(key))

  function loadText(text: string, sourceName: string) {
    const parsed = parseDelimited(text)

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setMessage(
        "Aucune ligne lue. Le fichier doit contenir une ligne d'en-têtes puis au moins une ligne de lot.",
      )
      return
    }

    setMessage(null)
    setTable(parsed)
    setSource(sourceName)
    setMapping(autoMapColumns(parsed.headers))
    setLines([])
    setRows([])
    setStep("colonnes")
  }

  async function readFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      loadText(decodeSpreadsheetBytes(buffer), file.name)
    } catch {
      setMessage("Lecture du fichier impossible. Réessayez, ou collez vos cellules ci-dessous.")
    }
  }

  function setColumn(index: number, key: ImportFieldKey | null) {
    setMapping((current) =>
      current.map((value, i) => {
        if (i === index) return key
        // Un champ ne peut servir qu'une fois : l'ancienne colonne est libérée.
        return key !== null && value === key ? null : value
      }),
    )
  }

  function startPreview() {
    if (!table) return
    const built = buildImportRows(table, mapping)

    if (built.length === 0) {
      setMessage("Aucune ligne à importer une fois les colonnes associées.")
      return
    }

    requestId.current = crypto.randomUUID()
    setMessage(null)

    startTransition(async () => {
      const result = await validateImportRows(built)

      if (!result.ok) {
        setMessage(result.message)
        return
      }

      // Les contrôles locaux complètent le verdict de la base (nom de
      // locataire incomplet, qu'elle n'attrape qu'à l'insertion).
      const merged = result.lines.map((line) => {
        const row = built[line.line - 1]
        return row ? { ...line, errors: [...line.errors, ...localRowErrors(row)] } : line
      })

      setRows(built)
      setLines(merged)
      setStep("apercu")
    })
  }

  function runImport() {
    if (rows.length === 0 || errorCount > 0) return
    setMessage(null)

    startTransition(async () => {
      const result = await runPortfolioImport(rows, requestId.current)

      if (!result.ok) {
        setMessage(result.message)
        return
      }

      setSummary(result.summary)
      setStep("termine")
    })
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = TEMPLATE_FILE_NAME
    link.click()
    URL.revokeObjectURL(url)
  }

  function restart() {
    setStep("fichier")
    setTable(null)
    setSource("")
    setMapping([])
    setPaste("")
    setRows([])
    setLines([])
    setSummary(null)
    setMessage(null)
  }

  return (
    <div className="space-y-8">
      {step !== "termine" ? <StepBar step={step} /> : null}

      {message ? <Alert variant="error">{message}</Alert> : null}

      {step === "fichier" ? (
        <div className="space-y-6">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = event.dataTransfer.files?.[0]
              if (file) void readFile(file)
            }}
            className="rounded-2xl border border-dashed border-border bg-card p-6 text-center"
          >
            <p className="text-base leading-7 text-foreground/70">
              Déposez votre fichier CSV, ou choisissez-le sur l&apos;appareil.
            </p>
            <input
              id="fichier-portefeuille"
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void readFile(file)
                event.target.value = ""
              }}
            />
            <label
              htmlFor="fichier-portefeuille"
              className={buttonClasses("primary", "mt-5 w-full cursor-pointer sm:w-auto")}
            >
              Choisir un fichier
            </label>
          </div>

          <div className="space-y-3">
            <label htmlFor="collage" className={labelClass}>
              Ou collez vos cellules Excel
            </label>
            <textarea
              id="collage"
              rows={4}
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              placeholder={"Propriétaire\tImmeuble\tLot\tLoyer"}
              className={`${selectClass} font-mono text-sm`}
            />
            <button
              type="button"
              onClick={() => loadText(paste, "Cellules collées")}
              disabled={paste.trim() === ""}
              className={buttonClasses("secondary", "w-full sm:w-auto")}
            >
              Utiliser ce collage
            </button>
          </div>

          <div className={cardClass}>
            <p className="text-sm leading-6 text-foreground/70">
              Une colonne par information : propriétaire, bien, lot, locataire, loyer. Un lot sans
              locataire est importé comme vacant.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Télécharger un modèle
            </button>
          </div>
        </div>
      ) : null}

      {step === "colonnes" && table ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              À quoi correspond chaque colonne ?
            </h2>
            <p className="text-sm text-muted-foreground">
              {source} · {table.headers.length} colonnes · {table.rows.length} lignes
            </p>
          </div>

          {missingRequired.length > 0 ? (
            <Alert variant="warning">
              Indiquez la colonne :{" "}
              {missingRequired.map((key) => importFieldLabel(key).toLowerCase()).join(", ")}.
            </Alert>
          ) : null}

          <div className="space-y-3">
            {table.headers.map((header, index) => {
              const sample = table.rows.find((row) => row[index] !== "")?.[index] ?? ""

              return (
                <div key={`${header}-${index}`} className={cardClass}>
                  <label htmlFor={`colonne-${index}`} className={labelClass}>
                    {header === "" ? `Colonne ${index + 1}` : header}
                  </label>
                  {sample ? (
                    <p className="mt-1 truncate text-sm text-muted-foreground">Exemple : {sample}</p>
                  ) : null}
                  <select
                    id={`colonne-${index}`}
                    value={mapping[index] ?? ""}
                    onChange={(event) =>
                      setColumn(index, (event.target.value || null) as ImportFieldKey | null)
                    }
                    className={`${selectClass} mt-3`}
                  >
                    <option value="">Ne pas importer</option>
                    {IMPORT_FIELD_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {IMPORT_FIELDS.filter((field) => field.group === group).map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                            {field.required ? " (obligatoire)" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startPreview}
              disabled={pending || missingRequired.length > 0}
              className={buttonClasses("primary", "w-full sm:w-auto")}
            >
              {pending ? "Vérification…" : "Vérifier les lignes"}
            </button>
            <button type="button" onClick={restart} className={buttonClasses("secondary")}>
              Changer de fichier
            </button>
          </div>
        </div>
      ) : null}

      {step === "apercu" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              {readyCount} {readyCount > 1 ? "lignes prêtes" : "ligne prête"}
              {errorCount > 0 ? `, ${errorCount} à corriger` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              {errorCount > 0
                ? "Corrigez votre fichier, puis rechargez-le. Rien n'est enregistré tant qu'il reste une erreur."
                : "Chaque ligne crée son lot ; les lignes avec locataire activent le bail et ses échéances."}
            </p>
          </div>

          {errorCount > 0 ? (
            <div className="space-y-3">
              {lines
                .filter((line) => line.errors.length > 0)
                .map((line) => (
                  <div
                    key={line.line}
                    className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-foreground">
                        {line.unit_label || `Ligne ${line.line}`}
                      </p>
                      <Badge variant="error">Ligne {line.line}</Badge>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-destructive">
                      {line.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {lines
              .filter((line) => line.errors.length === 0)
              .slice(0, PREVIEW_LIMIT)
              .map((line) => {
                const row = rows[line.line - 1]

                return (
                  <div
                    key={line.line}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {line.unit_label || `Ligne ${line.line}`}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row ? tenantLabel(row) : ""}
                        {row?.owner_name ? ` · ${row.owner_name}` : ""}
                      </p>
                    </div>
                    {row && rentLabel(row) ? (
                      <p className="shrink-0 text-sm font-medium text-foreground">{rentLabel(row)}</p>
                    ) : null}
                  </div>
                )
              })}
            {readyCount > PREVIEW_LIMIT ? (
              <p className="text-sm text-muted-foreground">
                et {readyCount - PREVIEW_LIMIT} autres lignes prêtes.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runImport}
              disabled={pending || !online || errorCount > 0 || readyCount === 0}
              className={buttonClasses("primary", "w-full sm:w-auto")}
            >
              {pending
                ? "Import en cours…"
                : !online
                  ? "Hors ligne — en attente du réseau"
                  : `Importer ${readyCount} ${readyCount > 1 ? "lots" : "lot"}`}
            </button>
            <button
              type="button"
              onClick={() => setStep("colonnes")}
              disabled={pending}
              className={buttonClasses("secondary")}
            >
              Revoir les colonnes
            </button>
          </div>
        </div>
      ) : null}

      {step === "termine" && summary ? (
        <div className="space-y-6">
          <Alert variant="success">Portefeuille importé.</Alert>

          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Lots", value: summary.units_created },
              { label: "Biens", value: summary.properties_created },
              { label: "Propriétaires", value: summary.owners_created },
              { label: "Locataires", value: summary.tenants_created },
              { label: "Baux activés", value: summary.leases_activated },
              { label: "Échéances générées", value: summary.rent_dues_generated },
            ].map((item) => (
              <div key={item.label} className={cardClass}>
                <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                <dd className="mt-2 text-2xl font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-3">
            <Link href="/properties" className={buttonClasses("primary", "w-full sm:w-auto")}>
              Voir le portefeuille
            </Link>
            <Link href="/owners" className={buttonClasses("secondary")}>
              Voir les propriétaires
            </Link>
            <button type="button" onClick={restart} className={buttonClasses("secondary")}>
              Importer un autre fichier
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
