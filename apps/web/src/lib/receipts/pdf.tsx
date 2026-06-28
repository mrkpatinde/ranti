/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { formatFcfa } from "@/lib/format"
import type { Landlord } from "@/lib/landlords"
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0A0A0A", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerBox: { borderBottomWidth: 1, borderBottomColor: "#E5E5E5", paddingBottom: 14, marginBottom: 14 },
  logoMark: { width: 28, height: 28, backgroundColor: "#0A0A0A", borderRadius: 6, padding: 6, justifyContent: "center" },
  bar: { height: 2.5, backgroundColor: "#FFFFFF", borderRadius: 2, marginBottom: 2.5 },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  muted: { color: "#737373" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "right" },
  block: { borderBottomWidth: 1, borderBottomColor: "#E5E5E5", paddingVertical: 14 },
  label: { fontSize: 8, color: "#A3A3A3", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  strong: { fontFamily: "Helvetica-Bold" },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  total: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  mention: { paddingVertical: 14, color: "#525252", lineHeight: 1.5 },
  qr: { width: 70, height: 70 },
  qrBox: { width: 70, height: 70, borderWidth: 1, borderColor: "#D4D4D4", alignItems: "center", justifyContent: "center" },
  sigLine: { width: 160, borderTopWidth: 1, borderTopColor: "#D4D4D4", paddingTop: 4, fontSize: 8, color: "#A3A3A3", textAlign: "center" },
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

  return (
    <Document title={`${kind} ${receipt.receipt_number}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, s.headerBox]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.logoMark}>
              <View style={[s.bar, { width: 16 }]} />
              <View style={[s.bar, { width: 12 }]} />
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
            {receipt.status === "cancelled" ? <Text style={[{ textAlign: "right", color: "#A32D2D" }]}>Annulée</Text> : null}
          </View>
        </View>

        <View style={[s.row, s.block]}>
          <View style={{ width: "48%" }}>
            <Text style={s.label}>De</Text>
            <Text style={s.strong}>{landlord.first_name} {landlord.last_name}</Text>
            <Text style={s.muted}>Propriétaire</Text>
            {landlord.phone ? <Text style={s.muted}>{landlord.phone}</Text> : null}
          </View>
          <View style={{ width: "48%" }}>
            <Text style={s.label}>À</Text>
            <Text style={s.strong}>{snap.tenant ? `${snap.tenant.first_name} ${snap.tenant.last_name}` : "Locataire"}</Text>
            <Text style={s.muted}>Locataire</Text>
            {snap.unit ? <Text style={s.muted}>{snap.unit.name}</Text> : null}
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

        <Text style={s.mention}>{receipt.kind === "quittance" ? "Le présent document vaut quittance : le loyer de la période ci-dessus est intégralement payé." : "Reçu de paiement pour la somme ci-dessus. Le loyer n'est pas intégralement soldé : ce document ne vaut pas quittance."}</Text>

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
