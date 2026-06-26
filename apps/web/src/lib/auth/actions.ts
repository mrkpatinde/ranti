"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "./paths"
import { normalizeOtp, normalizePassword, normalizePhone } from "./validation"
import type { AuthResult } from "./types"

export async function signUpWithPhonePassword(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))
  const password = normalizePassword(formData.get("password"))

  if (!phone) {
    return {
      ok: false,
      message: "Numéro invalide. Utilisez le format international, par exemple +229…",
      code: "invalid_phone_input",
    }
  }

  if (!password) {
    return {
      ok: false,
      message: "Le mot de passe doit contenir au moins 8 caractères.",
      code: "invalid_password_input",
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({ phone, password })

  if (error) {
    const alreadyExists =
      error.code === "user_already_exists" || /already.*regist/i.test(error.message)

    return {
      ok: false,
      message: alreadyExists
        ? "Ce numéro a déjà un espace. Connectez-vous."
        : "Création de l'espace impossible. Réessayez.",
      code: alreadyExists ? "user_already_exists" : error.code,
    }
  }

  // Supabase obfuscates existing accounts: a user with no identities means the
  // phone is already registered.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      ok: false,
      message: "Ce numéro a déjà un espace. Connectez-vous.",
      code: "user_already_exists",
    }
  }

  return { ok: true }
}

export async function verifyPhoneSignup(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))
  const code = normalizeOtp(formData.get("code"))

  if (!phone || !code) {
    return {
      ok: false,
      message: "Numéro ou code invalide.",
      code: "invalid_otp_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" })

  if (error) {
    return {
      ok: false,
      message: "Code invalide ou expiré.",
      code: error.code,
    }
  }

  revalidatePath("/", "layout")

  return { ok: true }
}

export async function resendSignupCode(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))

  if (!phone) {
    return {
      ok: false,
      message: "Numéro invalide.",
      code: "invalid_phone_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resend({ type: "sms", phone })

  if (error) {
    return {
      ok: false,
      message: "Impossible de renvoyer le code. Réessayez dans un instant.",
      code: error.code,
    }
  }

  return { ok: true }
}

export async function signInWithPhonePassword(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))
  const password = normalizePassword(formData.get("password"))

  if (!phone || !password) {
    return {
      ok: false,
      message: "Numéro ou mot de passe invalide.",
      code: "invalid_credentials_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ phone, password })

  if (error) {
    return {
      ok: false,
      message: "Connexion impossible. Vérifiez votre numéro et votre mot de passe.",
      code: error.code,
    }
  }

  revalidatePath("/", "layout")

  return { ok: true }
}

export async function requestRecoveryCode(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))

  if (!phone) {
    return {
      ok: false,
      message: "Numéro invalide.",
      code: "invalid_phone_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  })

  if (error) {
    return {
      ok: false,
      message: "Impossible d'envoyer le code de récupération.",
      code: error.code,
    }
  }

  return { ok: true }
}

export async function completeRecovery(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))
  const code = normalizeOtp(formData.get("code"))
  const password = normalizePassword(formData.get("password"))

  if (!phone || !code) {
    return {
      ok: false,
      message: "Numéro ou code invalide.",
      code: "invalid_otp_input",
    }
  }

  if (!password) {
    return {
      ok: false,
      message: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      code: "invalid_password_input",
    }
  }

  const supabase = await createClient()

  const { error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  })

  if (verifyError) {
    return {
      ok: false,
      message: "Code invalide ou expiré.",
      code: verifyError.code,
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    return {
      ok: false,
      message: "Impossible de mettre à jour le mot de passe.",
      code: updateError.code,
    }
  }

  revalidatePath("/", "layout")

  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  revalidatePath("/", "layout")
  redirect(AUTH_PATHS.afterSignOut)
}
