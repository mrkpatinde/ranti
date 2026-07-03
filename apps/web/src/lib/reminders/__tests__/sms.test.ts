import { describe, expect, it } from "vitest";
import { getReminderTemplate, REMINDER_TEMPLATES } from "../sms";

describe("getReminderTemplate", () => {
  it("J-5 à J-2 → j-5", () => {
    expect(getReminderTemplate(5)).toBe("j-5");
    expect(getReminderTemplate(2)).toBe("j-5");
  });

  it("J-1 → j-1 (dû demain)", () => {
    expect(getReminderTemplate(1)).toBe("j-1");
  });

  it("J-0 → j-0 (dû aujourd'hui, pas « demain »)", () => {
    expect(getReminderTemplate(0)).toBe("j-0");
  });

  it("retard 1 à 9 jours → j+3", () => {
    expect(getReminderTemplate(-1)).toBe("j+3");
    expect(getReminderTemplate(-9)).toBe("j+3");
  });

  it("retard 10 jours ou plus → j+10", () => {
    expect(getReminderTemplate(-10)).toBe("j+10");
    expect(getReminderTemplate(-30)).toBe("j+10");
  });

  it("plus de 5 jours avant l'échéance → null", () => {
    expect(getReminderTemplate(6)).toBeNull();
  });
});

describe("REMINDER_TEMPLATES", () => {
  it("j-0 mentionne aujourd'hui et inclut le lien", () => {
    const msg = REMINDER_TEMPLATES["j-0"]("80 000 FCFA", "", "https://x/c/t");
    expect(msg).toContain("aujourd'hui");
    expect(msg).toContain("https://x/c/t");
  });

  it("j-1 mentionne demain", () => {
    expect(REMINDER_TEMPLATES["j-1"]("80 000 FCFA", "", "l")).toContain("demain");
  });
});
