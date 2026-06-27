-- ============================================================
-- Migration 018 : Reminders & Tenant Confirmation
-- Description : Ajoute les colonnes de relance sur rent_dues,
--   la table reminders, le statut 'draft' sur rent_receptions
--   pour la confirmation locataire, et les index nécessaires.
-- ============================================================

BEGIN;

-- 1. AJOUT DES COLONNES DE RELANCE SUR rent_dues
--    Ces colonnes permettent au cron de savoir quand relancer
--    et au locataire d'accéder à sa page de confirmation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rent_dues' AND column_name = 'confirmation_token'
  ) THEN
    ALTER TABLE rent_dues
      ADD COLUMN confirmation_token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
      ADD COLUMN last_reminder_at TIMESTAMPTZ,
      ADD COLUMN next_reminder_at TIMESTAMPTZ,
      ADD COLUMN reminder_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. ÉLARGIR LA CONTRAINTE CHECK DE rent_receptions.status
--    Ajouter 'draft' pour les confirmations locataires non encore
--    validées par le propriétaire.
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Trouver la contrainte CHECK existante sur status
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'rent_receptions'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%status%';

  -- Si une contrainte existe, la supprimer et la recréer
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE rent_receptions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Recréer la contrainte avec les 3 statuts
ALTER TABLE rent_receptions DROP CONSTRAINT IF EXISTS rent_receptions_status_check;
ALTER TABLE rent_receptions
  ADD CONSTRAINT rent_receptions_status_check
  CHECK (status IN ('draft', 'confirmed', 'cancelled'));

-- Changer le default de 'confirmed' à 'draft' pour les nouvelles
-- insertions (les entrées créées par le locataire seront en draft)
-- Note : on ne change PAS le default existant pour ne pas casser
-- le flux proprio actuel. Les Server Actions existantes continuent
-- de mettre explicitement 'confirmed'.
-- ALTER TABLE rent_receptions ALTER COLUMN status SET DEFAULT 'draft';
-- ↑ laissé commenté : sera activé quand le flux locataire sera en production

-- 3. CRÉATION DE LA TABLE reminders
--    Trace chaque relance envoyée (SMS, WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_due_id UUID NOT NULL REFERENCES rent_dues(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES landlords(id),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  template TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. INDEX POUR LE CRON DE RELANCE
--    Optimise la requête quotidienne qui cherche les échéances à relancer
CREATE INDEX IF NOT EXISTS idx_rent_dues_reminder
  ON rent_dues(status, next_reminder_at)
  WHERE status IN ('pending', 'overdue') AND deleted_at IS NULL;

-- Index pour retrouver les relances d'une échéance
CREATE INDEX IF NOT EXISTS idx_reminders_rent_due
  ON reminders(rent_due_id, sent_at DESC);

-- Index pour le dashboard propriétaire (relances du mois)
CREATE INDEX IF NOT EXISTS idx_reminders_landlord_date
  ON reminders(landlord_id, created_at DESC);

-- 5. ROW LEVEL SECURITY SUR reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Le propriétaire voit uniquement ses propres relances
DROP POLICY IF EXISTS "Landlords see own reminders" ON reminders;
CREATE POLICY "Landlords see own reminders" ON reminders
  FOR SELECT
  USING (landlord_id = current_setting('app.current_landlord_id')::uuid);

-- Seul le service (cron) peut insérer des reminders
-- (Le cron utilise la service_role key qui bypass RLS)
-- Les landlords n'ont pas le droit d'insérer/modifier des reminders

-- 6. AUDIT TRIGGER SUR reminders
SELECT audit.create_trigger('reminders');

COMMIT;

-- ============================================================
-- ROLLBACK (si nécessaire) :
--   ALTER TABLE rent_dues DROP COLUMN confirmation_token,
--     DROP COLUMN last_reminder_at,
--     DROP COLUMN next_reminder_at,
--     DROP COLUMN reminder_count;
--   ALTER TABLE rent_receptions DROP CONSTRAINT rent_receptions_status_check;
--   ALTER TABLE rent_receptions ADD CONSTRAINT ... (ancienne def);
--   DROP TABLE reminders CASCADE;
-- ============================================================
