import { describe, expect, it } from "vitest"
import { formatFcfa } from "@/lib/format"
import {
  DEFAULT_BATCH_TEMPLATE,
  buildBatchMessages,
  buildTemplateVars,
  defaultBatchTemplate,
  groupReminderRows,
  isFullySelected,
  orderedSelection,
  renderReminderTemplate,
  renderRowMessage,
  toggleAll,
  toggleSelection,
  type ReminderBatchRow,
} from "../batch"

function row(over: Partial<ReminderBatchRow> = {}): ReminderBatchRow {
  return {
    rent_due_id: "d1",
    lease_id: "l1",
    tenant_id: "t1",
    owner_id: "o1",
    owner_name: "Mme Hounkpatin",
    property_name: "Résidence Zogbo",
    unit_name: "Lot A",
    tenant_name: "Awa Diop",
    tenant_phone: "+22990010203",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    due_date: "2026-08-05",
    currency: "XOF",
    amount_remaining: 120_000,
    days_from_due: 4,
    reminder_type: "late_j_3",
    last_reminder_at: null,
    reminder_count: 0,
    ...over,
  }
}

describe("substitution du modèle", () => {
  it("remplace chaque champ par la valeur de la ligne", () => {
    const message = renderRowMessage(row(), DEFAULT_BATCH_TEMPLATE)

    expect(message).toBe(
      `Bonjour Awa Diop, le loyer de Lot A pour août 2026 reste dû : ${formatFcfa(120_000)}.`,
    )
  })

  it("modèle personnalisé : tous les champs disponibles", () => {
    const message = renderRowMessage(
      row(),
      "{locataire} · {bien} · {lot} · {période} · {montant} · {échéance} · {retard}",
    )

    expect(message).toBe(
      `Awa Diop · Résidence Zogbo · Lot A · août 2026 · ${formatFcfa(120_000)} · 5 août 2026 · 4 jours`,
    )
  })

  it("champ inconnu : laissé tel quel plutôt qu'un trou dans le message", () => {
    expect(renderReminderTemplate("Bonjour {locataire}, {inconnu}.", { locataire: "Awa" })).toBe(
      "Bonjour Awa, {inconnu}.",
    )
  })

  it("données manquantes : repli neutre, jamais « undefined »", () => {
    const vars = buildTemplateVars(row({ tenant_name: null, unit_name: null }))

    expect(vars.locataire).toBe("Madame, Monsieur")
    expect(vars.lot).toBe("votre logement")
    expect(renderRowMessage(row({ tenant_name: null }), DEFAULT_BATCH_TEMPLATE)).not.toContain(
      "undefined",
    )
  })

  it("retard au singulier au premier jour, zéro avant l'échéance", () => {
    expect(buildTemplateVars(row({ days_from_due: 1 })).retard).toBe("1 jour")
    expect(buildTemplateVars(row({ days_from_due: -3 })).retard).toBe("0 jours")
  })

  it("les messages du lot sont indexés par échéance", () => {
    const rows = [row({ rent_due_id: "d1" }), row({ rent_due_id: "d2", tenant_name: "Koffi" })]

    const messages = buildBatchMessages(rows, "Bonjour {locataire}.")

    expect(messages).toEqual({ d1: "Bonjour Awa Diop.", d2: "Bonjour Koffi." })
  })
})

// Numéro marchand dans le lot (retour fondateur 2026-08-10) : le modèle par
// défaut gagne {paiement} quand l'alias du compte existe ; la variable se
// substitue en instruction de paiement complète, vide sans alias.
describe("instruction de paiement du lot", () => {
  const account = { paymentAlias: "0197000001", payeeName: "Horizon Gestion" }

  it("modèle par défaut : {paiement} ajouté seulement quand l'alias existe", () => {
    expect(defaultBatchTemplate(account)).toBe(`${DEFAULT_BATCH_TEMPLATE} {paiement}`)
    expect(defaultBatchTemplate(null)).toBe(DEFAULT_BATCH_TEMPLATE)
    expect(defaultBatchTemplate({ paymentAlias: "  ", payeeName: "X" })).toBe(
      DEFAULT_BATCH_TEMPLATE,
    )
  })

  it("{paiement} devient l'instruction complète avec l'alias et la raison sociale", () => {
    const message = renderRowMessage(row(), defaultBatchTemplate(account), account)

    expect(message.endsWith("Réglez au 0197000001 (Mobile Money — Horizon Gestion).")).toBe(
      true,
    )
  })

  it("sans alias : {paiement} se substitue à vide, sans espace orphelin", () => {
    const message = renderRowMessage(row(), `${DEFAULT_BATCH_TEMPLATE} {paiement}`, null)

    expect(message).toBe(renderRowMessage(row(), DEFAULT_BATCH_TEMPLATE))
    expect(message.endsWith(" ")).toBe(false)
  })

  it("sans compte : message du lot identique à avant", () => {
    const message = renderRowMessage(row(), DEFAULT_BATCH_TEMPLATE)
    expect(message).not.toContain("Réglez au")
  })
})

describe("sélection du lot", () => {
  const ids = ["d1", "d2", "d3"]

  it("coche puis décoche une ligne", () => {
    expect(toggleSelection(["d1"], "d2")).toEqual(["d1", "d2"])
    expect(toggleSelection(["d1", "d2"], "d1")).toEqual(["d2"])
  })

  it("« tout sélectionner » complète la sélection partielle", () => {
    expect(toggleAll(["d2"], ids)).toEqual(["d2", "d1", "d3"])
  })

  it("« tout sélectionner » sur un lot déjà complet le vide", () => {
    expect(toggleAll(ids, ids)).toEqual([])
  })

  it("un groupe se décoche sans toucher au reste de la file", () => {
    expect(toggleAll(["d1", "d2", "d9"], ["d1", "d2"])).toEqual(["d9"])
  })

  it("file vide : « tout sélectionner » n'est jamais coché", () => {
    expect(isFullySelected([], [])).toBe(false)
    expect(isFullySelected(["d1"], ids)).toBe(false)
    expect(isFullySelected(ids, ids)).toBe(true)
  })

  it("les lignes cochées sortent dans l'ordre de la file, pas des clics", () => {
    const rows = [row({ rent_due_id: "d1" }), row({ rent_due_id: "d2" }), row({ rent_due_id: "d3" })]

    expect(orderedSelection(rows, ["d3", "d1"]).map((r) => r.rent_due_id)).toEqual(["d1", "d3"])
  })
})

describe("regroupement de la file", () => {
  const rows = [
    row({ rent_due_id: "d1", owner_id: "o1", owner_name: "Hounkpatin", property_name: "Zogbo" }),
    row({ rent_due_id: "d2", owner_id: "o2", owner_name: "Adjovi", property_name: "Zogbo" }),
    row({ rent_due_id: "d3", owner_id: "o1", owner_name: "Hounkpatin", property_name: "Calavi" }),
  ]

  it("par mandant, ordre d'apparition conservé", () => {
    const groups = groupReminderRows(rows, "owner")

    expect(groups.map((g) => g.label)).toEqual(["Hounkpatin", "Adjovi"])
    expect(groups[0].rows.map((r) => r.rent_due_id)).toEqual(["d1", "d3"])
  })

  it("par bien", () => {
    const groups = groupReminderRows(rows, "property")

    expect(groups.map((g) => g.label)).toEqual(["Zogbo", "Calavi"])
    expect(groups[0].rows).toHaveLength(2)
  })

  it("lot sans mandant : regroupé à part plutôt que masqué", () => {
    const groups = groupReminderRows([row({ owner_id: null, owner_name: null })], "owner")

    expect(groups[0].label).toBe("Sans mandant")
    expect(groups[0].rows).toHaveLength(1)
  })

  it("chaque ligne se retrouve dans exactement un groupe", () => {
    const total = groupReminderRows(rows, "owner").reduce((sum, g) => sum + g.rows.length, 0)

    expect(total).toBe(rows.length)
  })
})
