import type { Civility } from "@/lib/auth/validation"

export type Landlord = {
  id: string
  auth_user_id: string
  phone: string
  first_name: string
  last_name: string
  civility: Civility | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
