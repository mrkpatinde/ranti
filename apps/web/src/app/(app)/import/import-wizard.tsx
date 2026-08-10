"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import { Alert } from "@/components/ui/alert"
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
import {
  buildImportRows,
  columnSamples,
  localRowErrors,
  missingEssentialKeys,
  questionCandidates,
  understandTable,
} from "@/lib/import/mapping"
import { runPortfolioImport, validateImportRows } from "@/lib/import/actions"
import { buildPortfolioSummary, summaryLine } from "@/lib/import/summary"
import { buildTemplateCsv, TEMPLATE_FILE_NAME } from "@/lib/import/template"
import type { ImportRow, ImportSummary, ValidationLine } from "@/lib/import/types"
import { useOnline } from "@/lib/use-online"

// L'écran montre ce qu'on a compris du fichier, jamais comment on l'a compris.
// Accueil → questions (seulement si une colonne reste à clarifier, une à la
// fois) → récapitulatif « Voici ce qu'on a compris » → import. La grille
// complète des colonnes reste dans « colonnes », accessible par le lien
// « Régler les colonnes moi-même » — pour les fichiers tordus.
type Stage = "accueil" | "questions" | "immeuble" | "manque" | "colonnes" | "recap" | "termine"

const cardClass = "rounded-2xl border border-border bg-card p-5"
const headingClass = "font-display text-xl font-extrabold tracking-tight text-foreground"
const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"
const choiceClass =
  "w-full rounded-2xl border border-border bg-card px-5 py-4 text-left text-base font-medium text-foreground transition hover:border-primary disabled:opacity-60"
const quietLinkClass =
  "text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"

// Au-delà, le détail devient illisible sur mobile : on montre le début et on
// annonce le reste. Les lignes à corriger, elles, sont toutes affichées.
const DETAIL_LIMIT = 25

export function ImportWizard() {
  const online = useOnline()
  const [pending, startTransition] = useTransition()

  const [stage, setStage] = useState<Stage>("accueil")
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [source, setSource] = useState<string>("")
  const [mapping, setMapping] = useState<(ImportFieldKey | null)[]>([])
  // Colonnes à clarifier, posées une par une.
  const [queue, setQueue] = useState<number[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  // Réponse à « Ces lots sont dans le même immeuble ? » — appliquée à toutes
  // les lignes qui n'ont pas d'immeuble.
  const [buildingName, setBuildingName] = useState("")
  const [missing, setMissing] = useState<ImportFieldKey[]>([])
  const [paste, setPaste] = useState("")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [lines, setLines] = useState<ValidationLine[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Clé d'idempotence de la tentative : renouvelée à chaque nouvel aperçu, donc
  // stable tant que l'agence rejoue le MÊME import (double clic, reprise
  // réseau) — la base renvoie alors le récapitulatif d'origine.
  const requestId = useRef<string>("")

  const errorsByLine = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const line of lines) {
      if (line.errors.length > 0) map.set(line.line, line.errors)
    }
    return map
  }, [lines])

  const errorCount = errorsByLine.size
  const readyCount = rows.length - errorCount

  const portfolio = useMemo(() => buildPortfolioSummary(rows), [rows])

  // Lignes affichées dans le détail : toutes celles à corriger, et les
  // premières lignes prêtes jusqu'à la limite mobile.
  const visibleLines = useMemo(() => {
    const visible = new Set<number>()
    let shown = 0
    for (let line = 1; line <= rows.length; line += 1) {
      if (errorsByLine.has(line)) {
        visible.add(line)
        continue
      }
      if (shown < DETAIL_LIMIT) {
        visible.add(line)
        shown += 1
      }
    }
    return visible
  }, [rows, errorsByLine])

  const hiddenReadyCount = Math.max(0, readyCount - DETAIL_LIMIT)

  const displayOwners = useMemo(
    () =>
      portfolio.owners
        .map((owner) => ({
          ...owner,
          properties: owner.properties
            .map((property) => ({
              ...property,
              units: property.units.filter((unit) => visibleLines.has(unit.line)),
            }))
            .filter((property) => property.units.length > 0),
        }))
        .filter((owner) => owner.properties.length > 0),
    [portfolio, visibleLines],
  )

  const ignoredHeaders = useMemo(() => {
    if (!table) return []
    return table.headers
      .map((header, index) =>
        mapping[index] === null ? (header === "" ? `Colonne ${index + 1}` : header) : null,
      )
      .filter((header): header is string => header !== null)
  }, [table, mapping])

  // La question en cours : en-tête, vraies valeurs du fichier et propositions,
  // recalculées à chaque réponse pour ne jamais proposer un rôle déjà pris.
  const question = useMemo(() => {
    if (stage !== "questions" || !table) return null
    const column = queue[queueIndex]
    if (column === undefined) return null

    const rawHeader = table.headers[column] ?? ""
    const header = rawHeader === "" ? `Colonne ${column + 1}` : rawHeader
    const taken = new Set(
      mapping.filter(
        (key, index): key is ImportFieldKey => key !== null && index !== column,
      ),
    )

    return {
      column,
      header,
      samples: columnSamples(table.rows, column),
      candidates: questionCandidates(header, taken),
    }
  }, [stage, table, queue, queueIndex, mapping])

  // La grille manuelle exige bien + lot ; le nom d'immeuble répondu à la
  // question « même immeuble » couvre le bien.
  const missingRequired = REQUIRED_FIELD_KEYS.filter(
    (key) =>
      !mapping.includes(key) && !(key === "property_name" && buildingName.trim() !== ""),
  )

  function loadText(text: string, sourceName: string) {
    const parsed = parseDelimited(text)

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setMessage(
        "Aucune ligne lue. Le fichier doit contenir une ligne d'en-têtes puis au moins une ligne de lot.",
      )
      return
    }

    const understanding = understandTable(parsed)

    setMessage(null)
    setTable(parsed)
    setSource(sourceName)
    setMapping(understanding.mapping)
    setQueue(understanding.questions.map((item) => item.column))
    setQueueIndex(0)
    setBuildingName("")
    setMissing([])
    setRows([])
    setLines([])

    if (understanding.questions.length > 0) {
      setStage("questions")
      return
    }

    continueAfterQuestions(parsed, understanding.mapping, "")
  }

  async function readFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      loadText(decodeSpreadsheetBytes(buffer), file.name)
    } catch {
      setMessage("Lecture du fichier impossible. Réessayez, ou collez vos cellules ci-dessous.")
    }
  }

  // Après la dernière question (ou d'emblée si tout est compris) : la question
  // de l'immeuble unique si aucune colonne n'en donne, la liste de ce qui
  // manque encore, sinon directement le récapitulatif.
  function continueAfterQuestions(
    currentTable: ParsedTable,
    currentMapping: (ImportFieldKey | null)[],
    fallbackName: string,
  ) {
    if (!currentMapping.includes("property_name") && fallbackName.trim() === "") {
      setStage("immeuble")
      return
    }

    const missingKeys = missingEssentialKeys(
      currentTable,
      currentMapping,
      fallbackName.trim() !== "",
    )
    if (missingKeys.length > 0) {
      setMissing(missingKeys)
      setStage("manque")
      return
    }

    startPreview(currentTable, currentMapping, fallbackName)
  }

  function answerQuestion(column: number, key: ImportFieldKey | null) {
    const next = mapping.map((value, index) => {
      if (index === column) return key
      // Un rôle ne peut servir qu'une fois : l'ancienne colonne est libérée.
      return key !== null && value === key ? null : value
    })
    setMapping(next)

    const nextIndex = queueIndex + 1
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex)
      return
    }
    if (!table) return
    continueAfterQuestions(table, next, buildingName)
  }

  function setColumn(index: number, key: ImportFieldKey | null) {
    setMapping((current) =>
      current.map((value, i) => {
        if (i === index) return key
        // Un rôle ne peut servir qu'une fois : l'ancienne colonne est libérée.
        return key !== null && value === key ? null : value
      }),
    )
  }

  function startPreview(
    currentTable: ParsedTable,
    currentMapping: (ImportFieldKey | null)[],
    fallbackName: string,
  ) {
    const name = fallbackName.trim()
    const built = buildImportRows(
      currentTable,
      currentMapping,
      name === "" ? undefined : { property_name: name },
    )

    if (built.length === 0) {
      setMessage("Aucune ligne à importer dans ce fichier.")
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
      setStage("recap")
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
      setStage("termine")
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

  function openGrid() {
    setMessage(null)
    setStage("colonnes")
  }

  function restart() {
    setStage("accueil")
    setTable(null)
    setSource("")
    setMapping([])
    setQueue([])
    setQueueIndex(0)
    setBuildingName("")
    setMissing([])
    setPaste("")
    setRows([])
    setLines([])
    setSummary(null)
    setMessage(null)
  }

  return (
    <div className="space-y-8">
      {message ? <Alert variant="error">{message}</Alert> : null}

      {stage === "accueil" ? (
        <div className="space-y-6">
          <p className="text-base leading-7 text-foreground/70">
            Envoyez votre fichier tel quel — vos colonnes, vos intitulés.
          </p>

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
              Déposez votre fichier ici, ou choisissez-le sur l&apos;appareil.
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
              className={`${inputClass} font-mono text-sm`}
            />
            <button
              type="button"
              onClick={() => loadText(paste, "Cellules collées")}
              disabled={paste.trim() === "" || pending}
              className={buttonClasses("secondary", "w-full sm:w-auto")}
            >
              Utiliser ce collage
            </button>
          </div>

          {pending ? (
            <p className="text-sm text-muted-foreground" role="status">
              Lecture de votre fichier…
            </p>
          ) : null}

          <p className="border-t border-border pt-5 text-sm text-muted-foreground">
            Vous n&apos;avez pas encore de fichier ?{" "}
            <button
              type="button"
              onClick={downloadTemplate}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Voir un exemple
            </button>
          </p>
        </div>
      ) : null}

      {stage === "questions" && table && question ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Question {queueIndex + 1} sur {queue.length}
          </p>

          <div className="space-y-2">
            <h2 className={headingClass}>
              Que contient la colonne « {question.header} » ?
            </h2>
            {question.samples.length > 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Dans votre fichier : {question.samples.join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {question.candidates.map((candidate) => (
              <button
                key={candidate.key}
                type="button"
                disabled={pending}
                onClick={() => answerQuestion(question.column, candidate.key)}
                className={choiceClass}
              >
                {importFieldLabel(candidate.key)}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => answerQuestion(question.column, null)}
              className={`${choiceClass} border-dashed font-normal text-muted-foreground`}
            >
              Ignorer cette colonne
            </button>
          </div>

          {pending ? (
            <p className="text-sm text-muted-foreground" role="status">
              Vérification des lignes…
            </p>
          ) : null}

          <p>
            <button type="button" onClick={openGrid} className={quietLinkClass}>
              Régler les colonnes moi-même
            </button>
          </p>
        </div>
      ) : null}

      {stage === "immeuble" && table ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className={headingClass}>Ces lots sont dans le même immeuble ?</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Votre fichier n&apos;indique pas d&apos;immeuble. Donnez son nom : il sera appliqué
              aux {table.rows.length} lignes.
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="nom-immeuble" className={labelClass}>
              Nom de l&apos;immeuble
            </label>
            <input
              id="nom-immeuble"
              type="text"
              value={buildingName}
              onChange={(event) => setBuildingName(event.target.value)}
              placeholder="Ex. Résidence Fifadji"
              className={inputClass}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || buildingName.trim() === ""}
              onClick={() => table && continueAfterQuestions(table, mapping, buildingName)}
              className={buttonClasses("primary", "w-full sm:w-auto")}
            >
              {pending ? "Vérification…" : "Continuer"}
            </button>
            <button type="button" onClick={restart} className={buttonClasses("secondary")}>
              Changer de fichier
            </button>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Plusieurs immeubles ? Ajoutez une colonne avec le nom de l&apos;immeuble sur chaque
            ligne, puis renvoyez le fichier.
          </p>

          <p>
            <button type="button" onClick={openGrid} className={quietLinkClass}>
              Régler les colonnes moi-même
            </button>
          </p>
        </div>
      ) : null}

      {stage === "manque" && table ? (
        <div className="space-y-6">
          {missing.includes("unit_name") ? (
            <>
              <div className="space-y-2">
                <h2 className={headingClass}>La colonne des lots est introuvable</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Chaque ligne doit indiquer son lot — A1, Chambre 2, Boutique… Ajoutez cette
                  colonne à votre fichier, ou réglez les colonnes vous-même.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openGrid}
                  className={buttonClasses("primary", "w-full sm:w-auto")}
                >
                  Régler les colonnes moi-même
                </button>
                <button type="button" onClick={restart} className={buttonClasses("secondary")}>
                  Changer de fichier
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className={headingClass}>Il manque une partie du bail</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Nous n&apos;avons pas trouvé :{" "}
                  {missing.map((key) => importFieldLabel(key).toLowerCase()).join(", ")}. Sans
                  ces informations, les baux des locataires ne seront pas activés — chaque ligne
                  concernée sera signalée avant l&apos;import.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => table && startPreview(table, mapping, buildingName)}
                  className={buttonClasses("primary", "w-full sm:w-auto")}
                >
                  {pending ? "Vérification…" : "Continuer"}
                </button>
                <button type="button" onClick={openGrid} className={buttonClasses("secondary")}>
                  Régler les colonnes moi-même
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {stage === "colonnes" && table ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className={headingClass}>Réglez chaque colonne</h2>
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
                    className={`${inputClass} mt-3`}
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
              onClick={() => table && startPreview(table, mapping, buildingName)}
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

      {stage === "recap" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className={headingClass}>Voici ce qu&apos;on a compris</h2>
            <p className="text-base font-medium text-foreground">{summaryLine(portfolio)}</p>
            {errorCount > 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {readyCount} {readyCount > 1 ? "lignes prêtes" : "ligne prête"}, {errorCount} à
                corriger. Rien n&apos;est enregistré tant qu&apos;il reste une erreur — corrigez
                votre fichier puis rechargez-le.
              </p>
            ) : null}
          </div>

          <div className="space-y-5">
            {displayOwners.map((owner, ownerIndex) => (
              <section key={`${owner.name}-${ownerIndex}`} className="space-y-3">
                {owner.name !== "" ? (
                  <h3 className="text-sm font-medium text-muted-foreground">{owner.name}</h3>
                ) : null}
                {owner.properties.map((property, propertyIndex) => (
                  <div key={`${property.name}-${propertyIndex}`} className={cardClass}>
                    <p className="font-medium text-foreground">
                      {property.name === "" ? "Immeuble sans nom" : property.name}
                    </p>
                    <ul className="mt-2 divide-y divide-border">
                      {property.units.map((unit) => {
                        const unitErrors = errorsByLine.get(unit.line) ?? []

                        return (
                          <li key={unit.line} className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {unit.name === "" ? `Ligne ${unit.line}` : unit.name}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {unit.tenantName ?? "Vacant"}
                                </p>
                              </div>
                              {unit.rent !== null ? (
                                <p className="shrink-0 text-sm font-medium text-foreground">
                                  {formatFcfa(unit.rent)}
                                </p>
                              ) : null}
                            </div>
                            {unitErrors.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-sm text-destructive">
                                {unitErrors.map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
            {hiddenReadyCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                et {hiddenReadyCount} autres lots prêts.
              </p>
            ) : null}
          </div>

          {ignoredHeaders.length > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {ignoredHeaders.length}{" "}
              {ignoredHeaders.length > 1 ? "colonnes ignorées" : "colonne ignorée"} (
              {ignoredHeaders.join(", ")}) — vos données ne sont pas perdues, elles ne sont juste
              pas importées.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runImport}
              disabled={pending || !online || errorCount > 0 || rows.length === 0}
              className={buttonClasses("primary", "w-full sm:w-auto")}
            >
              {pending
                ? "Import en cours…"
                : !online
                  ? "Hors ligne — en attente du réseau"
                  : rows.length > 1
                    ? `Importer ces ${rows.length} lots`
                    : "Importer ce lot"}
            </button>
            <button type="button" onClick={restart} className={buttonClasses("secondary")}>
              Changer de fichier
            </button>
          </div>

          <p>
            <button type="button" onClick={openGrid} className={quietLinkClass}>
              Régler les colonnes moi-même
            </button>
          </p>
        </div>
      ) : null}

      {stage === "termine" && summary ? (
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
