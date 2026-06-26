"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AUTH_PATHS } from "./paths"
import { normalizeEmail, normalizePassword, normalizePhone } from "./validation"
import type { AuthResult } from "./types"

export async function signInWithEmailPassword(formData: FormData): Promise<AuthResult> {
  const email = normalizeEmail(formData.get("email"))
  const password = normalizePassword(formData.get("password"))

  if (!email || !password) {
    return {
      ok: false,
      message: "Email ou mot de passe invalide.",
      code: "invalid_credentials_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      ok: false,
      message: "Connexion impossible. Vérifie tes informations.",
      code: error.code,
    }
  }

  revalidatePath("/", "layout")

  return {
    ok: true,
  }
}

export async function signUpWithEmailPassword(formData: FormData): Promise<AuthResult> {
  const email = normalizeEmail(formData.get("email"))
  const password = normalizePassword(formData.get("password"))

  if (!email || !password) {
    return {
      ok: false,
      message: "Email ou mot de passe invalide.",
      code: "invalid_signup_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return {
      ok: false,
      message: "Création du compte impossible.",
      code: error.code,
    }
  }

  revalidatePath("/", "layout")

  return {
    ok: true,
  }
}

export async function signInWithEmailOtp(formData: FormData): Promise<AuthResult> {
  const email = normalizeEmail(formData.get("email"))

  if (!email) {
    return {
      ok: false,
      message: "Email invalide.",
      code: "invalid_email_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })

  if (error) {
    return {
      ok: false,
      message: "Impossible d’envoyer le lien de connexion.",
      code: error.code,
    }
  }

  return {
    ok: true,
  }
}

export async function signInWithPhoneOtp(formData: FormData): Promise<AuthResult> {
  const phone = normalizePhone(formData.get("phone"))

  if (!phone) {
    return {
      ok: false,
      message: "Numéro de téléphone invalide. Utilise le format international, par exemple +229...",
      code: "invalid_phone_input",
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    phone,
  })

  if (error) {
    return {
      ok: false,
      message: "Impossible d’envoyer le code de connexion.",
      code: error.code,
    }
  }

  return {
    ok: true,
  }
}

export async function signOut() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  revalidatePath("/", "layout")
  redirect(AUTH_PATHS.afterSignOut)
}
