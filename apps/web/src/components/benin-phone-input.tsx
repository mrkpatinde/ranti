"use client"

import { useState } from "react"

type BeninPhoneInputProps = {
  id: string
  name: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  className?: string
  autoComplete?: string
  title?: string
}

export function formatBeninLocalPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10)

  if (digits.length <= 2) return digits

  const parts = [digits.slice(0, 2)]
  for (let index = 2; index < digits.length; index += 2) {
    parts.push(digits.slice(index, index + 2))
  }

  return parts.join(" ")
}

export function BeninPhoneInput({
  id,
  name,
  defaultValue = "",
  placeholder = "01 90 00 00 00",
  required = false,
  className,
  autoComplete = "tel-national",
  title = "Entrez les 10 chiffres du numéro béninois : 01 90 00 00 00.",
}: BeninPhoneInputProps) {
  const [value, setValue] = useState(formatBeninLocalPhone(defaultValue))

  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      autoComplete={autoComplete}
      value={value}
      onChange={(event) => setValue(formatBeninLocalPhone(event.target.value))}
      placeholder={placeholder}
      required={required}
      pattern="01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}"
      title={title}
      maxLength={14}
      className={className}
    />
  )
}
