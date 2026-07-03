// ============================================================
// Module SMS — Africa's Talking
// Utilisé par le cron de relance pour envoyer les SMS aux locataires
// ============================================================

const AT_API_KEY = process.env.AT_API_KEY || "";
const AT_USERNAME = process.env.AT_USERNAME || "sandbox"; // 'sandbox' pour les tests
const AT_BASE_URL = "https://api.africastalking.com/version1";

// Templates de messages par fenêtre de relance
export const REMINDER_TEMPLATES = {
  "j-5": (montant: string, date: string, lien: string) =>
    `Ranti — Votre loyer de ${montant} arrive a echeance le ${date}. Confirmez votre paiement : ${lien}`,

  "j-1": (montant: string, _date: string, lien: string) =>
    `Ranti — Rappel : votre loyer de ${montant} est du demain. Confirmez : ${lien}`,

  "j-0": (montant: string, _date: string, lien: string) =>
    `Ranti — Rappel : votre loyer de ${montant} est du aujourd'hui. Confirmez : ${lien}`,

  "j+3": (montant: string, mois: string, lien: string) =>
    `Ranti — Votre loyer de ${montant} (${mois}) est en retard. Regularisez : ${lien}`,

  "j+10": (montant: string, mois: string) =>
    `Ranti — Votre loyer de ${montant} (${mois}) est en retard de 10 jours. Contactez votre proprietaire.`,
};

export type ReminderTemplate = keyof typeof REMINDER_TEMPLATES;

export interface SmsResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envoie un SMS via Africa's Talking.
 * En mode sandbox (AT_USERNAME='sandbox'), log le message au lieu d'envoyer.
 */
export async function sendSms(
  phone: string,
  message: string
): Promise<SmsResult> {
  // Mode sandbox : ne pas envoyer de vrais SMS
  if (AT_USERNAME === "sandbox" || !AT_API_KEY) {
    console.log(`[SMS SANDBOX] To: ${phone} | Message: ${message}`);
    return {
      ok: true,
      messageId: `sandbox_${Date.now()}`,
    };
  }

  try {
    const response = await fetch(`${AT_BASE_URL}/messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: AT_API_KEY,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        username: AT_USERNAME,
        to: phone,
        message,
        from: "Ranti", // Sender ID (doit être approuvé par l'opérateur)
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[SMS] Africa's Talking error:", data);
      return { ok: false, error: data.message || "SMS send failed" };
    }

    const recipients = data?.SMSMessageData?.Recipients || [];
    const first = recipients[0];

    if (first?.status === "Success") {
      return { ok: true, messageId: first.messageId };
    }

    return { ok: false, error: first?.status || "Unknown SMS status" };
  } catch (err) {
    console.error("[SMS] Network error:", err);
    return { ok: false, error: "Network error" };
  }
}

/**
 * Détermine quel template utiliser selon la distance à la date d'échéance.
 */
export function getReminderTemplate(daysUntilDue: number): ReminderTemplate | null {
  if (daysUntilDue <= -10) return "j+10"; // 10 jours de retard ou plus
  if (daysUntilDue < 0) return "j+3"; // en retard
  if (daysUntilDue === 0) return "j-0"; // dû aujourd'hui
  if (daysUntilDue === 1) return "j-1"; // dû demain
  if (daysUntilDue <= 5) return "j-5"; // J-5 à J-2
  return null; // Trop tôt pour relancer
}

/**
 * Formate un numéro de téléphone pour Africa's Talking.
 * Bénin : +229 01 2345 6789 → +2290123456789
 */
export function formatPhoneForSms(phone: string): string {
  // Supprimer les espaces et caractères non numériques (sauf le +)
  const cleaned = phone.replace(/[^\d+]/g, "");
  // Africa's Talking attend le format international sans le +
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}
