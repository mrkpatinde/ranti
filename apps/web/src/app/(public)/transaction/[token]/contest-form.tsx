"use client";

import { buttonClasses } from "@/components/ui/button";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { contestCharge } from "./actions";

// Formulaire de contestation d'une charge (ADR-023 §4). La nature choisie
// révèle le champ pertinent ; le commentaire libre reste facultatif.
// Ranti documente le désaccord, ne l'arbitre pas.
export function ContestForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [nature, setNature] = useState<"amount" | "not_owed" | "already_paid" | "other" | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-full border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
      >
        Signaler une erreur
      </button>
    );
  }

  const natures: Array<{ value: "amount" | "not_owed" | "already_paid" | "other"; label: string }> = [
    { value: "amount", label: "Le montant est faux" },
    { value: "not_owed", label: "Je ne dois pas cette somme" },
    { value: "already_paid", label: "Je l'ai déjà réglée" },
    { value: "other", label: "Autre chose" },
  ];

  return (
    <form action={contestCharge.bind(null, token)} className="space-y-4 text-left">
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
            Montant que vous reconnaissez (FCFA)
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="numeric"
            placeholder="Ex. 3000"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      <div>
        <label htmlFor="comment" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Précisez si besoin (facultatif)
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          maxLength={500}
          placeholder="Ex. la réparation n'a pas été faite"
          className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
        >
          Annuler
        </button>
        <SubmitButton className={buttonClasses("destructive", "flex-1")} pendingLabel="Envoi…">
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
