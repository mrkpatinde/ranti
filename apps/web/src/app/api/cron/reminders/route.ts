// ============================================================
// Cron : vérifie les échéances à relancer chaque jour
// Route GET /api/cron/reminders — appelée par Vercel Cron
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { sendSms, getReminderTemplate, formatPhoneForSms, REMINDER_TEMPLATES } from "@/lib/reminders/sms";
import { formatCurrency } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Ne pas mettre en cache

/**
 * Vercel Cron handler.
 * Protégé par le header Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  // Vérification d'autorisation
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await checkRemindersDue();

  return Response.json({
    ok: true,
    sent,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Cherche les rent_dues qui nécessitent une relance et envoie un SMS.
 * Retourne le nombre de relances envoyées.
 */
export async function checkRemindersDue(): Promise<number> {
  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
  let sent = 0;

  // 1. Récupérer les échéances à relancer
  //    Critères :
  //    - Statut : pending, overdue, ou pending_confirmation
  //    - Non supprimée
  //    - next_reminder_at est NULL (jamais relancée) ou dépassé
  //    - Le locataire a un numéro de téléphone
  const { data: duesToRemind, error } = await supabase
    .from("rent_dues")
    .select(`
      id,
      landlord_id,
      tenant_id,
      unit_id,
      amount_due,
      currency,
      due_date,
      status,
      confirmation_token,
      reminder_count,
      period_start,
      period_end,
      tenant:tenants!inner(phone, first_name, last_name),
      unit:units(name),
      property:units(property:properties(name))
    `)
    .in("status", ["pending", "overdue", "pending_confirmation"])
    .is("deleted_at", null)
    .not("tenant.phone", "is", null)
    .or("next_reminder_at.is.null,next_reminder_at.lte", now.toISOString())
    .order("due_date", { ascending: true })
    .limit(50); // Limite de sécurité : max 50 SMS par exécution

  if (error) {
    console.error("checkRemindersDue: query failed", error);
    return 0;
  }

  if (!duesToRemind || duesToRemind.length === 0) {
    console.log(`[CRON] ${today}: Aucune relance à envoyer.`);
    return 0;
  }

  // 2. Pour chaque échéance, déterminer le template et envoyer
  for (const due of duesToRemind) {
    try {
      // Calculer la distance à la date d'échéance
      const dueDate = new Date(due.due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Déterminer le template
      const template = getReminderTemplate(daysUntilDue);
      if (!template) {
        // Trop tôt pour relancer — mettre next_reminder_at à J-5
        const jMinus5 = new Date(dueDate);
        jMinus5.setDate(jMinus5.getDate() - 5);
        await supabase
          .from("rent_dues")
          .update({ next_reminder_at: jMinus5.toISOString() })
          .eq("id", due.id);
        continue;
      }

      // Construire le message
      const phone = formatPhoneForSms(due.tenant?.phone || "");
      if (!phone || phone === "+") {
        console.warn(`checkRemindersDue: pas de téléphone pour due ${due.id}`);
        continue;
      }

      const montant = formatCurrency(due.amount_due, due.currency);
      const dateEcheance = dueDate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const mois = dueDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });

      const PUBLIC_URL = process.env.PUBLIC_URL || "https://ranti.app";
      const lien = `${PUBLIC_URL}/confirmer/${due.confirmation_token}`;

      const templateFn = REMINDER_TEMPLATES[template];
      const message = templateFn(montant, dateEcheance, lien);

      // Si déjà relancé J+10 ou plus, on arrête
      if (template === "j+10" && due.reminder_count >= 3) {
        console.log(`[CRON] Arrêt des relances pour due ${due.id} (J+10, ${due.reminder_count} relances)`);
        await supabase
          .from("rent_dues")
          .update({ next_reminder_at: null }) // Plus de relance
          .eq("id", due.id);
        continue;
      }

      // Envoyer le SMS
      const result = await sendSms(phone, message);

      // Enregistrer la relance
      const { error: insertError } = await supabase
        .from("reminders")
        .insert({
          rent_due_id: due.id,
          landlord_id: due.landlord_id,
          channel: "sms",
          template,
          recipient: phone,
          status: result.ok ? "sent" : "failed",
          message_id: result.messageId || null,
        });

      if (insertError) {
        console.error("checkRemindersDue: failed to log reminder", insertError);
      }

      // Mettre à jour l'échéance
      const nextReminderDays = getNextReminderDelay(template);
      const nextReminder = new Date(now);
      nextReminder.setDate(nextReminder.getDate() + nextReminderDays);

      await supabase
        .from("rent_dues")
        .update({
          last_reminder_at: now.toISOString(),
          next_reminder_at: nextReminderDays > 0 ? nextReminder.toISOString() : null,
          reminder_count: (due.reminder_count || 0) + 1,
        })
        .eq("id", due.id);

      sent++;
      console.log(
        `[CRON] Relance envoyée : due=${due.id} template=${template} phone=${phone.slice(0, 6)}****`
      );
    } catch (err) {
      console.error(`checkRemindersDue: error processing due ${due.id}`, err);
    }
  }

  console.log(`[CRON] ${today}: ${sent} relance(s) envoyée(s) sur ${duesToRemind.length} échéance(s) vérifiée(s).`);
  return sent;
}

/**
 * Détermine le délai avant la prochaine relance selon le template envoyé.
 */
function getNextReminderDelay(template: string): number {
  switch (template) {
    case "j-5": return 4;   // Prochaine relance à J-1
    case "j-1": return 4;   // Prochaine relance à J+3
    case "j+3": return 7;   // Prochaine relance à J+10
    case "j+10": return 0;   // Plus de relance
    default: return 0;
  }
}
