"use client"

import { useState } from "react"
import { CountryPhoneInput } from "@/components/country-phone-input"
import { SubmitButton } from "@/components/submit-button"
import type { CountryCode } from "@/lib/auth/countries"
// Import direct du fichier d'actions ("use server") : le barrel @/lib/landlords
// entraînerait queries.ts (client Supabase serveur) dans le bundle client.
import { createLandlordProfile } from "@/lib/landlords/actions"

// Bifurcation d'entrée (retour fondateur 2026-08-10) : première question, deux
// grandes cartes — « Une entreprise de gestion » / « Je gère en mon nom
// propre ». La branche entreprise demande la raison sociale (requise), le
// RCCM et l'IFU (optionnels), la ville et l'adresse, PUIS le signataire des
// documents (prénom, nom, téléphone). La branche nom propre garde le
// formulaire d'origine, sans champ entreprise.

type AccountType = "company" | "personal"

const fullInputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const phoneInputClass =
  "w-full rounded-r-xl border border-l-0 border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
const countrySelectClass =
  "rounded-l-xl border border-border bg-background px-3 py-3 text-base text-foreground/70 outline-none transition focus:border-primary"
const labelClass = "block text-sm font-medium text-foreground"

function TypeCard({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-5 text-left transition ${
        selected
          ? "border-accent bg-secondary"
          : "border-border bg-card hover:border-primary"
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-accent" : "border-border"
          }`}
        >
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
        </span>
        <span>
          <span className="block text-base font-semibold text-foreground">{title}</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {description}
          </span>
        </span>
      </span>
    </button>
  )
}

export function ProfileForm({
  defaultCountryCode,
  defaultPhone,
  errorMessage,
}: {
  defaultCountryCode: CountryCode
  defaultPhone: string
  errorMessage?: string
}) {
  const [accountType, setAccountType] = useState<AccountType | null>(null)

  return (
    <form action={createLandlordProfile} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className={labelClass}>Vous gérez des loyers comme…</legend>
        <TypeCard
          selected={accountType === "company"}
          title="Une entreprise de gestion"
          description="Agence ou société : vos documents portent la raison sociale."
          onSelect={() => setAccountType("company")}
        />
        <TypeCard
          selected={accountType === "personal"}
          title="Je gère en mon nom propre"
          description="Vos documents portent votre nom."
          onSelect={() => setAccountType("personal")}
        />
      </fieldset>

      {accountType ? (
        <input type="hidden" name="account_type" value={accountType} />
      ) : null}

      {accountType === "company" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="company_name" className={labelClass}>
              Raison sociale <span className="text-destructive">*</span>
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              maxLength={160}
              autoComplete="organization"
              placeholder="Ex : Horizon Gestion"
              className={fullInputClass}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Elle apparaît sur vos quittances et relevés de gestion.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="company_rccm" className={labelClass}>
                RCCM
              </label>
              <input
                id="company_rccm"
                name="company_rccm"
                type="text"
                maxLength={64}
                placeholder="Ex : RB/COT/24 B 12345"
                className={fullInputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="company_ifu" className={labelClass}>
                IFU
              </label>
              <input
                id="company_ifu"
                name="company_ifu"
                type="text"
                maxLength={64}
                inputMode="numeric"
                placeholder="13 chiffres"
                className={fullInputClass}
              />
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Optionnels — vous pourrez les ajouter plus tard dans les réglages.
          </p>

          <div className="space-y-2">
            <label htmlFor="city" className={labelClass}>
              Ville de l&apos;entreprise
            </label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={120}
              autoComplete="address-level2"
              placeholder="Cotonou"
              className={fullInputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className={labelClass}>
              Adresse de l&apos;entreprise
            </label>
            <input
              id="address"
              name="address"
              type="text"
              maxLength={200}
              autoComplete="street-address"
              placeholder="Rue, quartier, repère"
              className={fullInputClass}
            />
          </div>
        </div>
      ) : null}

      {accountType ? (
        <div className="space-y-5">
          {accountType === "company" ? (
            <div className="space-y-1 border-t border-border pt-5">
              <p className="text-sm font-medium text-foreground">
                Le signataire des documents
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                La personne qui signe les quittances au nom de l&apos;entreprise.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>
              Numéro de téléphone <span className="text-destructive">*</span>
            </label>
            <CountryPhoneInput
              id="phone"
              name="phone"
              defaultCountryCode={defaultCountryCode}
              defaultValue={defaultPhone}
              required
              selectClassName={countrySelectClass}
              inputClassName={phoneInputClass}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Choisissez votre indicatif, puis tapez votre numéro mobile local : Ranti ajoute les espaces automatiquement.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="first_name" className={labelClass}>
              Prénom <span className="text-destructive">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              autoComplete="given-name"
              className={fullInputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="last_name" className={labelClass}>
              Nom <span className="text-destructive">*</span>
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              autoComplete="family-name"
              className={fullInputClass}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Prénom et nom sont imprimés sur vos quittances — non modifiables ensuite.
            </p>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {accountType ? (
        <SubmitButton className="w-full rounded-full bg-accent px-4 py-3 text-base font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60">
          Accéder à mon espace
        </SubmitButton>
      ) : null}
    </form>
  )
}
