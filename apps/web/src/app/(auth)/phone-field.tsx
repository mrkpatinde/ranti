"use client"

import { useState } from "react"
import { formatLocalPhone, toLocalPhone } from "@/lib/auth/validation"

// Benin-only at the MVP: the 🇧🇯 +229 dialing code is fixed and shown as a
// non-editable prefix. The owner types only their local number, which must
// start with 01 and have 10 digits. Digits are auto-grouped in pairs
// (01 90 00 00 00) for readability; normalizePhone re-attaches the code and
// validates on the server.
export function PhoneField({
  defaultValue = "",
  labelClassName,
}: {
  defaultValue?: string
  labelClassName: string
}) {
  const [value, setValue] = useState(() => formatLocalPhone(toLocalPhone(defaultValue)))

  return (
    <div className="space-y-2">
      <label htmlFor="phone" className={labelClassName}>
        Numéro de téléphone
      </label>
      <div className="flex items-stretch rounded-xl border border-border bg-card transition focus-within:border-primary">
        <span className="flex select-none items-center gap-1.5 whitespace-nowrap border-r border-border px-4 text-base font-medium text-foreground/80">
          <span aria-hidden>🇧🇯</span>
          +229
        </span>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          value={value}
          onChange={(event) => setValue(formatLocalPhone(event.target.value))}
          autoComplete="tel"
          inputMode="numeric"
          placeholder="01 90 00 00 00"
          className="w-full rounded-r-xl bg-transparent px-4 py-3 text-base text-foreground outline-none"
        />
      </div>
    </div>
  )
}
