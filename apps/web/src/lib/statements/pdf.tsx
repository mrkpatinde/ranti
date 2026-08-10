import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { formatFcfa, formatFcfaNumber } from "@/lib/format"
import { registrationLine } from "@/lib/receipts/issuer"
import { monthLabel } from "./month"
import { feeRateLabel, sumStatementLines } from "./totals"
import type { OwnerStatement } from "./types"

// Relevé de gestion remis au mandant. Le document porte la marque de l'agence :
// c'est elle qui rend des comptes, Ranti n'est que l'outil (mention en pied).
// Palette = direction-artistique.html en dur (pas de CSS dans un PDF), même
// convention que lib/receipts/pdf.tsx. Polices de base WinAnsi : formatFcfa
// utilise U+00A0, jamais U+202F.

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatDateTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  return at.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

const COL = {
  lot: "30%",
  tenant: "22%",
  amount: "12%",
} as const

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: "#292929", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#e4e3db",
    paddingBottom: 14,
    marginBottom: 14,
  },
  agency: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#211f1c" },
  muted: { color: "#72726e" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#211f1c" },
  right: { textAlign: "right" },
  block: { borderBottomWidth: 1, borderBottomColor: "#e4e3db", paddingBottom: 14, marginBottom: 14 },
  label: {
    fontSize: 7,
    color: "#72726e",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  strong: { fontFamily: "Helvetica-Bold" },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d5d5d2",
    paddingBottom: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0efe8",
    paddingVertical: 5,
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#292929",
    paddingTop: 6,
    marginTop: 2,
  },
  th: { fontSize: 7, color: "#72726e", textTransform: "uppercase", letterSpacing: 0.6 },
  netBox: {
    backgroundColor: "#f2f6e1",
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  net: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#4c5616" },
  outstanding: {
    borderWidth: 1,
    borderColor: "#bd4a30",
    backgroundColor: "#ffe7e2",
    borderRadius: 4,
    padding: 10,
    marginTop: 10,
    color: "#bd4a30",
  },
  mention: { marginTop: 14, color: "#72726e", lineHeight: 1.5, fontSize: 8 },
  foot: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e4e3db",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#72726e",
  },
})

export function OwnerStatementPdf({ statement }: { statement: OwnerStatement }) {
  const { owner, agency, period, lines } = statement
  // Les totaux sont recalculés depuis les lignes imprimées : le pied de tableau
  // est exactement leur somme, quoi qu'il arrive.
  const totals = sumStatementLines(lines)
  const agencyName = agency.name?.trim() || "Agence"
  // RCCM/IFU (20260810130000) : petite ligne sous le nom quand présents.
  const agencyRegistration = registrationLine(agency.company_rccm, agency.company_ifu)
  const address = [agency.address, agency.city].filter(Boolean).join(", ")
  const rate = feeRateLabel(owner.fee_rate_bp)
  const periodLabel = monthLabel(period.month)

  return (
    <Document title={`Relevé de gestion ${periodLabel} — ${owner.display_name}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, s.headerBox]}>
          <View>
            <Text style={s.agency}>{agencyName}</Text>
            {agencyRegistration ? <Text style={s.muted}>{agencyRegistration}</Text> : null}
            {address ? <Text style={s.muted}>{address}</Text> : null}
            {agency.phone ? <Text style={s.muted}>{agency.phone}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>Relevé de gestion</Text>
            <Text style={[s.muted, s.right]}>{periodLabel}</Text>
            <Text style={[s.muted, s.right]}>
              Du {formatDate(period.from)} au {formatDate(period.to)}
            </Text>
          </View>
        </View>

        <View style={[s.row, s.block]}>
          <View style={{ width: "48%" }}>
            <Text style={s.label}>Propriétaire mandant</Text>
            <Text style={s.strong}>{owner.display_name}</Text>
            {owner.phone ? <Text style={s.muted}>{owner.phone}</Text> : null}
            {owner.email ? <Text style={s.muted}>{owner.email}</Text> : null}
          </View>
          <View style={{ width: "48%" }}>
            <Text style={s.label}>Honoraires de gestion</Text>
            <Text style={s.strong}>{rate} des sommes encaissées</Text>
            <Text style={s.muted}>Montants en francs CFA (XOF)</Text>
          </View>
        </View>

        <View style={s.tableHead} fixed>
          <Text style={[s.th, { width: COL.lot }]}>Bien · lot</Text>
          <Text style={[s.th, { width: COL.tenant }]}>Locataire</Text>
          <Text style={[s.th, s.right, { width: COL.amount }]}>Attendu</Text>
          <Text style={[s.th, s.right, { width: COL.amount }]}>Encaissé</Text>
          <Text style={[s.th, s.right, { width: COL.amount }]}>Honoraires</Text>
          <Text style={[s.th, s.right, { width: COL.amount }]}>Net</Text>
        </View>

        {lines.length === 0 ? (
          <Text style={[s.muted, { paddingVertical: 10 }]}>
            Aucun lot géré pour ce mandant sur la période.
          </Text>
        ) : (
          lines.map((line) => (
            <View key={line.unit_id} style={s.tableRow} wrap={false}>
              <Text style={{ width: COL.lot }}>
                {[line.property_name, line.unit_name].filter(Boolean).join(" · ") || "Lot"}
              </Text>
              <Text style={[{ width: COL.tenant }, line.tenant_name ? {} : s.muted]}>
                {line.tenant_name ?? "Vacant"}
              </Text>
              <Text style={[s.right, { width: COL.amount }]}>
                {formatFcfaNumber(line.expected)}
              </Text>
              <Text style={[s.right, { width: COL.amount }]}>
                {formatFcfaNumber(line.collected)}
              </Text>
              <Text style={[s.right, { width: COL.amount }]}>{formatFcfaNumber(line.fee)}</Text>
              <Text style={[s.right, s.strong, { width: COL.amount }]}>
                {formatFcfaNumber(line.net)}
              </Text>
            </View>
          ))
        )}

        <View style={s.totalRow}>
          <Text style={[s.strong, { width: COL.lot }]}>Total</Text>
          <Text style={[s.muted, { width: COL.tenant }]}>
            {lines.length} {lines.length > 1 ? "lots" : "lot"}
          </Text>
          <Text style={[s.right, s.strong, { width: COL.amount }]}>
            {formatFcfaNumber(totals.expected)}
          </Text>
          <Text style={[s.right, s.strong, { width: COL.amount }]}>
            {formatFcfaNumber(totals.collected)}
          </Text>
          <Text style={[s.right, s.strong, { width: COL.amount }]}>
            {formatFcfaNumber(totals.fee)}
          </Text>
          <Text style={[s.right, s.strong, { width: COL.amount }]}>
            {formatFcfaNumber(totals.net)}
          </Text>
        </View>

        <View style={s.netBox}>
          <Text style={s.strong}>Net à reverser au propriétaire</Text>
          <Text style={s.net}>{formatFcfa(totals.net)}</Text>
        </View>

        {totals.outstanding > 0 ? (
          <View style={s.outstanding}>
            <Text style={s.strong}>Impayé du mois : {formatFcfa(totals.outstanding)}</Text>
            <Text style={{ marginTop: 3 }}>
              Écart entre les loyers attendus sur la période et les sommes encaissées. Le
              recouvrement se poursuit.
            </Text>
          </View>
        ) : null}

        <Text style={s.mention}>
          Encaissé = sommes reçues et confirmées entre le {formatDate(period.from)} et le{" "}
          {formatDate(period.to)}. Honoraires = {rate} de l&apos;encaissé, calculés lot par lot.
          Net = encaissé moins honoraires. Le total est la somme des lignes ci-dessus.
        </Text>

        <View style={s.foot} fixed>
          <Text>
            {agencyName} · Relevé de gestion {periodLabel} · {owner.display_name}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Établi le ${formatDateTime(statement.generated_at)} · ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
