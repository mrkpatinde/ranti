"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireLandlordProfile } from "@/lib/landlords"
import { createClient } from "@/lib/supabase/server"
import { normalizeOptionalPropertyText, normalizePropertyName } from "./validation"

function propertyError(message: string): never {
  redirect(`/properties/new?error=${encodeURIComponent(message)}`)
}

export async function createProperty(formData: FormData) {
  const landlord = await requireLandlordProfile()

  const name = normalizePropertyName(formData.get("name"))
  const city = normalizeOptionalPropertyText(formData.get("city"), 80)
  const address = normalizeOptionalPropertyText(formData.get("address"), 160)
  const notes = normalizeOptionalPropertyText(formData.get("notes"), 500)

  if (!name) {
    propertyError("Donnez un nom simple à ce lieu.")
  }

  const supabase = await createClient()

  const { error } = await supabase.from("properties").insert({
    landlord_id: landlord.id,
    name,
    city,
    address,
    notes,
  })

  if (error) {
    propertyError("Impossible de créer ce lieu. Réessayez.")
  }

  revalidatePath("/dashboard")
  redirect("/dashboard?notice=property_created")
}
