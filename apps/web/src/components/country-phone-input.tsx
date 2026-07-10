"use client"

import { useState } from "react"
import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  formatCountryLocalPhone,
  getCountry,
  type CountryCode,
} from "@/lib/auth/countries"

type CountryPhoneInputProps = {
  id: string
  name: string
  // Name of the hidden-in-form country field read by the server action.
  countryFieldName?: string
  defaultCountryCode?: CountryCode
  defaultValue?: string
  required?: boolean
  selectClassName?: string
  inputClassName?: string
}

// Dialing-code selector + local mobile number input, driven by the country
// registry (ADR-008). The local part is grouped live per the country's
// numbering plan; the server action revalidates with normalizeCountryPhone.
export function CountryPhoneInput({
  id,
  name,
  countryFieldName = "country",
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
  defaultValue = "",
  required = false,
  selectClassName,
  inputClassName,
}: CountryPhoneInputProps) {
  const [countryCode, setCountryCode] = useState<CountryCode>(defaultCountryCode)
  const country = getCountry(countryCode) ?? COUNTRIES[0]
  const [value, setValue] = useState(formatCountryLocalPhone(country, defaultValue))

  return (
    <div className="flex">
      <select
        aria-label="Pays"
        name={countryFieldName}
        value={countryCode}
        onChange={(event) => {
          const next = getCountry(event.target.value) ?? COUNTRIES[0]
          setCountryCode(next.code)
          setValue((current) => formatCountryLocalPhone(next, current))
        }}
        className={selectClassName}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dialingCode}
          </option>
        ))}
      </select>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={(event) => setValue(formatCountryLocalPhone(country, event.target.value))}
        placeholder={country.placeholder}
        required={required}
        title={`Entrez les ${country.localDigits} chiffres du numéro mobile, ex. ${country.placeholder}.`}
        maxLength={country.localDigits + country.placeholder.split(" ").length - 1}
        className={inputClassName}
      />
    </div>
  )
}
