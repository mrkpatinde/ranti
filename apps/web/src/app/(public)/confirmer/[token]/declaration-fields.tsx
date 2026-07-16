"use client"

import { useState } from "react"

// Champs de déclaration locataire : moyen de paiement + référence.
// La référence devient obligatoire (required côté navigateur) dès que le moyen
// est traçable — Mobile Money ou virement. Le serveur revalide de toute façon
// (actions.ts), mais ce required bloque la soumission AVANT l'aller-retour :
// le locataire voit tout de suite qu'il manque la référence.
const REFERENCE_REQUIRED = new Set(["mobile_money", "bank_transfer"])

export function DeclarationFields() {
  const [method, setMethod] = useState("mobile_money")
  const referenceRequired = REFERENCE_REQUIRED.has(method)

  return (
    <>
      <div className="space-y-2">
        <label htmlFor="method" className="block text-sm font-medium text-foreground">
          Comment avez-vous payé ? <span className="text-destructive">*</span>
        </label>
        <select
          id="method"
          name="method"
          required
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
        >
          <option value="mobile_money">Mobile Money</option>
          <option value="cash">Espèces</option>
          <option value="bank_transfer">Virement bancaire</option>
          <option value="other">Autre</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="reference" className="block text-sm font-medium text-foreground">
          Référence de la transaction
          {referenceRequired ? <span className="text-destructive"> *</span> : null}
        </label>
        <input
          id="reference"
          name="reference"
          type="text"
          maxLength={120}
          required={referenceRequired}
          placeholder="Ex. ID de transaction Mobile Money (reçu par SMS)"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
        />
        <p className="text-xs text-muted-foreground">
          {referenceRequired
            ? "Obligatoire pour ce moyen — elle permet au propriétaire de vérifier votre paiement."
            : "Facultatif pour les espèces."}
        </p>
      </div>
    </>
  )
}
