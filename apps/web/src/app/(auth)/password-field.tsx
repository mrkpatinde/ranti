"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

// Password input with a show/hide toggle so the owner can check what they typed
// (passwords are easy to mistype on mobile keyboards).
export function PasswordField({
  autoComplete,
  minLength,
  placeholder,
  inputClassName,
}: {
  autoComplete: string
  minLength?: number
  placeholder?: string
  inputClassName: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${inputClassName} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 transition hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  )
}
