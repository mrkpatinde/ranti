/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { formatFcfa, monthYearLabel } from "@/lib/format"
import type { Landlord } from "@/lib/landlords"
import { receiptClause } from "./clause"
import type { Receipt } from "./types"

const methodLabels: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
}

const kindLabels: Record<string, string> = {
  quittance: "Quittance de loyer",
  receipt: "Reçu de paiement",
}

// ADR-013 - bandeau d'acquittement locataire (deux voix). Couleurs sobres,
// mentions strictement factuelles : Ranti documente, n'arbitre pas.
// Palette = direction-artistique.html uniquement (décision CEO 2026-07-17) :
// neutres papier/encre DA, certifié = wash + olive-deep, contesté = warning.
const ackBanner: Record<string, { bg: string; fg: string; label: string }> = {
  unilateral: { bg: "#f2f2ec", fg: "#72726e", label: "Déclaration du propriétaire, non confirmée par le locataire." },
  read: { bg: "#f2f2ec", fg: "#72726e", label: "Reçu ouvert par le locataire, non encore confirmé." },
  certified: { bg: "#f2f6e1", fg: "#3f4d00", label: "Certifié : le locataire a confirmé l'exactitude de ce reçu." },
  disputed: { bg: "#ffe7e2", fg: "#bd4a30", label: "Contesté : le locataire déclare une version différente (ci-dessous)." },
}

const contestNatureLabels: Record<string, string> = {
  amount: "Montant contesté",
  date: "Période contestée",
  not_paid: "Paiement contesté",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#292929", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerBox: { borderBottomWidth: 1, borderBottomColor: "#e4e3db", paddingBottom: 14, marginBottom: 14 },
  logoMark: { width: 28, height: 28, backgroundColor: "#292929", borderRadius: 6, padding: 6, justifyContent: "center" },
  bar: { height: 2.5, backgroundColor: "#f7f7f2", borderRadius: 2, marginBottom: 2.5 },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#211f1c" },
  muted: { color: "#72726e" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#211f1c" },
  block: { borderBottomWidth: 1, borderBottomColor: "#e4e3db", paddingVertical: 14 },
  label: { fontSize: 8, color: "#72726e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  strong: { fontFamily: "Helvetica-Bold" },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  total: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#211f1c" },
  mention: { paddingVertical: 14, color: "#72726e", lineHeight: 1.5 },
  qr: { width: 70, height: 70 },
  qrBox: { width: 70, height: 70, borderWidth: 1, borderColor: "#d5d5d2", alignItems: "center", justifyContent: "center" },
  sigLine: { width: 160, borderTopWidth: 1, borderTopColor: "#d5d5d2", paddingTop: 4, fontSize: 8, color: "#72726e", textAlign: "center" },
  ackBand: { borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14 },
  contestBox: { borderWidth: 1, borderColor: "#bd4a30", backgroundColor: "#ffe7e2", borderRadius: 4, padding: 12, marginTop: 4, marginBottom: 10 },
  fingerprint: { fontSize: 7, color: "#72726e", marginTop: 8, lineHeight: 1.4 },
})

export function ReceiptPdf({
  receipt,
  landlord,
  qrDataUrl,
}: {
  receipt: Receipt
  landlord: Landlord
  qrDataUrl: string | null
}) {
  const snap = receipt.snapshot ?? {}
  const kind = kindLabels[receipt.kind] ?? "Document"
  const ack = ackBanner[receipt.tenant_ack] ?? ackBanner.unilateral

  return (
    <Document title={`${kind} ${receipt.receipt_number}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, s.headerBox]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.logoMark}>
              <View style={[s.bar, { width: 16 }]} />
              <View style={[s.bar, { width: 12, backgroundColor: "#94f27f" }]} />
              <View style={[s.bar, { width: 8, marginBottom: 0 }]} />
            </View>
            <View style={{ marginLeft: 8 }}>
              <Text style={s.brand}>Ranti</Text>
              <Text style={s.muted}>Registre de loyer</Text>
            </View>
          </View>
          <View>
            <Text style={s.title}>{kind}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>N° {receipt.receipt_number}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Émise le {formatDate(receipt.issued_at)}</Text>
            {receipt.status === "cancelled" ? <Text style={[{ textAlign: "right", color: "#bd4a30" }]}>Annulée</Text> : null}
          </View>
        </View>

        <View style={[s.ackBand, { backgroundColor: ack.bg }]}>
          <Text style={{ color: ack.fg }}>{ack.label}</Text>
        </View>

        <View style={[s.row, s.block]}>
          <View style={{ width: "48%" }}>
            <Text style={s.label}>De</Text>
            <Text style={s.strong}>{landlord.first_name} {landlord.last_name}</Text>
            <Text style={s.muted}>Propriétaire</Text>
            {landlord.address || landlord.city ? (
              <Text style={s.muted}>{[landlord.address, landlord.city].filter(Boolean).join(", ")}</Text>
            ) : null}
            {landlord.phone ? <Text style={s.muted}>{landlord.phone}</Text> : null}
          </View>
          <View style={{ width: "48%" }}>
            <Text style={s.label}>À</Text>
            <Text style={s.strong}>{snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}` : "Locataire"}</Text>
            <Text style={s.muted}>Locataire</Text>
            {snap.unit ? <Text style={s.muted}>{snap.unit.name}</Text> : null}
            {snap.property && (snap.property.address || snap.property.city) ? (
              <Text style={s.muted}>{[snap.property.address, snap.property.city].filter(Boolean).join(", ")}</Text>
            ) : null}
          </View>
        </View>

        {snap.allocations && snap.allocations.length > 0 ? (
          <View style={s.block}>
            <View style={s.lineRow}>
              <Text style={s.label}>Période réglée</Text>
              <Text style={s.label}>Montant</Text>
            </View>
            {snap.allocations.map((a, i) => (
              <View key={i} style={s.lineRow}>
                <Text>{formatDate(a.period_start)} - {formatDate(a.period_end)}</Text>
                <Text>{formatFcfa(a.amount_allocated)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[s.row, s.block, { alignItems: "center" }]}>
          <View>
            <Text style={s.label}>Total payé</Text>
            {snap.reception ? <Text style={s.muted}>{methodLabels[snap.reception.payment_method] ?? snap.reception.payment_method} - reçu le {formatDate(snap.reception.received_at)}</Text> : null}
          </View>
          <Text style={s.total}>{formatFcfa(receipt.total_amount)}</Text>
        </View>

        <Text style={s.mention}>{receiptClause({ landlordName: `${landlord.first_name} ${landlord.last_name}`.trim() || "Propriétaire", tenantName: snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}`.trim() : "Locataire", amount: receipt.total_amount, kind: receipt.kind, period: snap.allocations?.length === 1 ? monthYearLabel(snap.allocations[0].period_start) : null })}</Text>

        {receipt.tenant_ack === "disputed" && receipt.contest_nature ? (
          <View style={s.contestBox}>
            <Text style={[s.label, { color: "#bd4a30" }]}>
              {contestNatureLabels[receipt.contest_nature] ?? "Contestation"} · version du locataire
            </Text>
            <Text style={{ color: "#bd4a30" }}>
              {receipt.contest_nature === "not_paid"
                ? "Le locataire déclare ne pas avoir payé ce loyer."
                : receipt.contest_nature === "amount"
                  ? `Le locataire déclare avoir payé ${receipt.contested_amount != null ? formatFcfa(receipt.contested_amount) : "un autre montant"}.`
                  : `Le locataire indique une autre période : ${receipt.contested_period || "non précisée"}.`}
            </Text>
            <Text style={[s.muted, { marginTop: 4 }]}>
              La déclaration du propriétaire ci-dessus est conservée. Ranti documente le désaccord, ne le tranche pas.
            </Text>
          </View>
        ) : null}

        {receipt.tenant_ack === "certified" && receipt.sha256_fingerprint ? (
          <Text style={s.fingerprint}>
            Empreinte d&apos;intégrité (SHA-256), certifiée par le locataire le{" "}
            {receipt.tenant_certified_at ? formatDate(receipt.tenant_certified_at) : ""} : {receipt.sha256_fingerprint}
          </Text>
        ) : null}

        <View style={[s.row, { alignItems: "flex-end", marginTop: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {qrDataUrl ? <Image src={qrDataUrl} style={s.qr} /> : <View style={s.qrBox}><Text style={s.muted}>QR</Text></View>}
            <Text style={[s.muted, { marginLeft: 8, width: 120 }]}>Vérifier l&apos;authenticité en ligne</Text>
          </View>
          <Text style={s.sigLine}>Signature du propriétaire</Text>
        </View>
      </Page>
    </Document>
  )
}
