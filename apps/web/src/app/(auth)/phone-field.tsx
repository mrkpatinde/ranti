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
      <div className="flex items-stretch rounded-xl border border-neutral-300 bg-white transition focus-within:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:focus-within:border-neutral-50">
        <span className="flex select-none items-center gap-1.5 whitespace-nowrap border-r border-neutral-200 px-4 text-base font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
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
          className="w-full rounded-r-xl bg-transparent px-4 py-3 text-base text-neutral-950 outline-none dark:text-neutral-50"
        />
      </div>
    </div>
  )
}
