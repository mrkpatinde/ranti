// Libellés d'affichage des relances, partagés entre la liste globale
// (/reminders) et le fil par bail (/leases/[id]). Voix « vous », côté
// propriétaire : on montre ce que Ranti a fait, jamais « envoyez vos relances ».

import type { ReminderWithContext } from "./queries"

export const reminderTemplateLabels: Record<string, string> = {
  "j-5": "Avant l'échéance (J-5)",
  "j-1": "Veille de l'échéance (J-1)",
  "j-0": "Jour de l'échéance",
  "j+1": "En retard (J+1)",
  "j+3": "En retard (J+3)",
  "j+10": "En retard (J+10)",
}

export const reminderChannelLabels: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  whatsapp_manual: "WhatsApp — équipe Ranti",
}

export const reminderStatusLabels: Record<ReminderWithContext["status"], string> = {
  sent: "Envoyée",
  delivered: "Remise",
  failed: "Échec d'envoi",
}
