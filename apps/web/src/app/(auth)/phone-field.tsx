import { toLocalPhone } from "@/lib/auth/validation"

// Benin-only at the MVP: the 🇧🇯 +229 dialing code is fixed and shown as a
// non-editable prefix. The owner types only their local number (01XXXXXXXX);
// normalizePhone re-attaches the code on the server.
export function PhoneField({
  defaultValue = "",
  labelClassName,
}: {
  defaultValue?: string
  labelClassName: string
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="phone" className={labelClassName}>
        Numéro de téléphone
      </label>
      <div className="flex items-stretch rounded-xl border border-neutral-300 bg-white transition focus-within:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:focus-within:border-neutral-50">
        <span className="flex select-none items-center gap-1 border-r border-neutral-200 px-3 text-base font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          🇧🇯 +229
        </span>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          defaultValue={toLocalPhone(defaultValue)}
          autoComplete="tel"
          inputMode="tel"
          placeholder="01 97 14 74 02"
          className="w-full rounded-r-xl bg-transparent px-4 py-3 text-base text-neutral-950 outline-none dark:text-neutral-50"
        />
      </div>
    </div>
  )
}
