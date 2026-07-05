// ============================================================
// Cron : vérifie les échéances à relancer chaque jour
// Route GET /api/cron/reminders — appelée par Vercel Cron
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendSms,
  getReminderTemplate,
  formatPhoneForSms,
  REMINDER_TEMPLATES,
} from "@/lib/reminders/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

/**
 * Vercel Cron handler.
 * Protégé par le header Authorization: *** */
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return Response.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Client service-role : le cron n'a pas de session utilisateur,
  // le client anon serait bloqué par RLS et ne verrait aucune échéance.
  const supabase = createAdminClient();
  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }

  const sent = await checkRemindersDue(supabase);

  return Response.json({
    ok: true,
    sent,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Cherche les rent_dues qui nécessitent une relance et envoie un SMS.
 */
async function checkRemindersDue(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<number> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  let sent = 0;

  // Récupérer les échéances à relancer
  const { data: duesToRemind, error } = await supabase
    .from("rent_dues")
    .select(
      "id, landlord_id, tenant_id, unit_id, amount_due, currency, due_date, status, confirmation_token, reminder_count, period_start, period_end, tenant:tenants!inner(phone, first_name, last_name), unit:units(name)",
    )
    .in("status", ["expected", "overdue"])
    .is("deleted_at", null)
    .not("tenant.phone", "is", null)
    .or(
      `next_reminder_at.is.null,next_reminder_at.lte.${now.toISOString()}`,
    )
    .order("due_date", { ascending: true })
    .limit(50);

  if (error) {
    console.error("checkRemindersDue: query failed", error);
    return 0;
  }

  if (!duesToRemind || duesToRemind.length === 0) {
    console.log(`[CRON] ${today}: Aucune relance à envoyer.`);
    return 0;
  }

  for (const due of duesToRemind) {
    try {
      const tenant = due.tenant as { phone?: string } | null;
      const phone = formatPhoneForSms(tenant?.phone || "");
      if (!phone || phone === "+") continue;

      const dueDate = new Date(due.due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const template = getReminderTemplate(daysUntilDue);
      if (!template) {
        // Trop tôt — programmer la prochaine vérification à J-5
        const jMinus5 = new Date(dueDate);
        jMinus5.setDate(jMinus5.getDate() - 5);
        await supabase
          .from("rent_dues")
          .update({ next_reminder_at: jMinus5.toISOString() })
          .eq("id", due.id);
        continue;
      }

      // Arrêter les relances après J+10
      if (template === "j+10" && (due.reminder_count || 0) >= 3) {
        await supabase
          .from("rent_dues")
          .update({ next_reminder_at: null })
          .eq("id", due.id);
        continue;
      }

      const montant = formatAmount(due.amount_due);
      const dateEcheance = dueDate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const mois = dueDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      const PUBLIC_URL =
        process.env.PUBLIC_URL || "https://www.monranti.com";
      const lien = `${PUBLIC_URL}/confirmer/${due.confirmation_token}`;

      const referenceDate = template.startsWith("j+") ? mois : dateEcheance;
      const message = template === "j+10"
        ? REMINDER_TEMPLATES[template](montant, referenceDate)
        : REMINDER_TEMPLATES[template](montant, referenceDate, lien);

      const result = await sendSms(phone, message);

      await supabase.from("reminders").insert({
        rent_due_id: due.id,
        landlord_id: due.landlord_id,
        channel: "sms",
        template,
        recipient: phone,
        status: result.ok ? "sent" : "failed",
        message_id: result.messageId || null,
      });

      const nextDelay = getNextReminderDelay(template);
      const nextReminder = new Date(now);
      nextReminder.setDate(nextReminder.getDate() + nextDelay);

      await supabase
        .from("rent_dues")
        .update({
          last_reminder_at: now.toISOString(),
          next_reminder_at:
            nextDelay > 0 ? nextReminder.toISOString() : null,
          reminder_count: (due.reminder_count || 0) + 1,
        })
        .eq("id", due.id);

      sent++;
      console.log(
        `[CRON] Relance envoyée : due=${due.id} template=${template}`,
      );
    } catch (err) {
      console.error(`checkRemindersDue: error for due ${due.id}`, err);
    }
  }

  console.log(
    `[CRON] ${today}: ${sent}/${duesToRemind.length} relance(s) envoyée(s).`,
  );
  return sent;
}

function getNextReminderDelay(template: string): number {
  switch (template) {
    case "j-5":
      return 4;
    case "j-1":
      return 4;
    case "j-0":
      return 4;
    case "j+3":
      return 7;
    default:
      return 0;
  }
}
