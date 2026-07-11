"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { contestReceipt } from "./actions";

// Formulaire de contestation locataire (ADR-013). La nature choisie révèle
// le champ pertinent : montant réel, ou période réelle. « Pas payé » n'a
// besoin d'aucun détail. Ranti documente le désaccord, ne l'arbitre pas.
export function ContestForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [nature, setNature] = useState<"amount" | "date" | "not_paid" | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-full border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
      >
        Ce reçu comporte une erreur
      </button>
    );
  }

  const natures: Array<{ value: "amount" | "date" | "not_paid"; label: string }> = [
    { value: "amount", label: "Le montant est faux" },
    { value: "date", label: "La période est fausse" },
    { value: "not_paid", label: "Je n'ai pas payé ce loyer" },
  ];

  return (
    <form action={contestReceipt.bind(null, token)} className="space-y-4 text-left">
      <p className="text-sm font-medium text-foreground">Qu&apos;est-ce qui ne va pas&nbsp;?</p>
      <div className="space-y-2">
        {natures.map((n) => (
          <label
            key={n.value}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary"
          >
            <input
              type="radio"
              name="nature"
              value={n.value}
              required
              onChange={() => setNature(n.value)}
              className="accent-primary"
            />
            <span className="text-foreground">{n.label}</span>
          </label>
        ))}
      </div>

      {nature === "amount" && (
        <div>
          <label htmlFor="amount" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Montant réellement payé (FCFA)
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="numeric"
            placeholder="Ex. 50000"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      {nature === "date" && (
        <div>
          <label htmlFor="period" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Période réellement concernée
          </label>
          <input
            id="period"
            name="period"
            type="text"
            placeholder="Ex. juin 2026"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
        >
          Annuler
        </button>
        <SubmitButton
          className="flex-1 rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          pendingLabel="Envoi…"
        >
          Contester
        </SubmitButton>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Votre version est enregistrée à côté de celle du propriétaire. Ranti ne
        tranche pas le litige, il le documente.
      </p>
    </form>
  );
}
