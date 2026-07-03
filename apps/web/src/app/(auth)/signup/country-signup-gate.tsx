"use client"

import { useState, type ReactNode } from "react"
import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  getCountry,
  supportsPhoneSignup,
  type CountryCode,
} from "@/lib/auth/countries"

// The signup forms are rendered server-side (server actions) and passed in as
// nodes; this client gate only decides which signup methods are visible for
// the selected country. Senegal and Côte d'Ivoire are Google-only for now.
export function CountrySignupGate({
  phoneSignup,
  googleSignup,
}: {
  phoneSignup: ReactNode
  googleSignup: ReactNode
}) {
  const [countryCode, setCountryCode] = useState<CountryCode>(DEFAULT_COUNTRY_CODE)
  const country = getCountry(countryCode) ?? COUNTRIES[0]
  const phoneAvailable = supportsPhoneSignup(country)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="country" className="block text-sm font-medium text-foreground">
          Pays
        </label>
        <select
          id="country"
          name="country"
          value={country.code}
          onChange={(event) => setCountryCode(event.target.value as CountryCode)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition focus:border-primary"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.dialingCode})
            </option>
          ))}
        </select>
      </div>

      {phoneAvailable ? (
        <>
          {phoneSignup}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {googleSignup}
        </>
      ) : (
        <>
          <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm leading-6 text-foreground/70">
            Au {country.name}, l&apos;inscription se fait pour le moment avec
            votre compte Google.
          </p>
          {googleSignup}
        </>
      )}
    </div>
  )
}
