import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { confirmRentPayment } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

// ============================================================
// Page de confirmation locataire — publique, zéro auth
// Le locataire arrive via le lien dans le SMS (ranti.app/c/[token])
// ============================================================

export default async function ConfirmerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Valider le format du token
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  // Chercher l'échéance correspondante
  const { data: rentDue, error } = await supabase
    .from("rent_dues")
    .select(`
      id,
      amount_due,
      currency,
      due_date,
      period_start,
      period_end,
      status,
      unit:units(name),
      property:units(property:properties(name)),
      tenant:tenants(first_name, last_name),
      lease:leases(monthly_rent_amount)
    `)
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error || !rentDue) {
    notFound();
  }

  // Vérifier si déjà confirmé/payé
  const { data: existingReception } = await supabase
    .from("rent_receptions")
    .select("id, status")
    .eq("unit_id", rentDue.unit_id)
    .eq("tenant_id", rentDue.tenant_id)
    .gte("received_at", rentDue.period_start)
    .lte("received_at", rentDue.period_end)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const alreadyConfirmed = existingReception?.status === "draft";
  const alreadyPaid = existingReception?.status === "confirmed";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-stone-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-semibold text-stone-900">
            Confirmation de loyer
          </CardTitle>
          <p className="text-sm text-stone-500 mt-1">
            {rentDue.property?.name} — {rentDue.unit?.name}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Détails de l'échéance */}
          <div className="bg-stone-100 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Locataire</span>
              <span className="text-stone-900 font-medium">
                {rentDue.tenant?.first_name} {rentDue.tenant?.last_name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Période</span>
              <span className="text-stone-900">
                {formatDate(rentDue.period_start)} – {formatDate(rentDue.period_end)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Échéance</span>
              <span className="text-stone-900">{formatDate(rentDue.due_date)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-stone-200">
              <span className="text-stone-700">Montant</span>
              <span className="text-stone-900 text-lg">
                {formatCurrency(rentDue.amount_due, rentDue.currency)}
              </span>
            </div>
          </div>

          {/* État actuel */}
          {alreadyPaid ? (
            <div className="text-center space-y-3">
              <Badge variant="success" className="text-sm px-4 py-1">
                Paiement validé
              </Badge>
              <p className="text-sm text-stone-500">
                Le propriétaire a confirmé la réception de ce loyer.
              </p>
            </div>
          ) : alreadyConfirmed ? (
            <div className="text-center space-y-3">
              <Badge variant="warning" className="text-sm px-4 py-1">
                En attente de validation
              </Badge>
              <p className="text-sm text-stone-500">
                Votre confirmation a bien été enregistrée.
                Le propriétaire va la vérifier.
              </p>
            </div>
          ) : rentDue.status === "paid" ? (
            <div className="text-center space-y-3">
              <Badge variant="success" className="text-sm px-4 py-1">
                Payé
              </Badge>
              <p className="text-sm text-stone-500">
                Cette échéance est déjà marquée comme payée.
              </p>
            </div>
          ) : (
            /* Formulaire de confirmation */
            <form action={confirmRentPayment.bind(null, rentDue.id)}>
              <Button type="submit" className="w-full" size="lg">
                J&apos;ai payé ce loyer
              </Button>
              <p className="text-xs text-stone-400 text-center mt-3">
                En cliquant, vous confirmez avoir payé votre loyer.
                Le propriétaire validera cette déclaration.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
