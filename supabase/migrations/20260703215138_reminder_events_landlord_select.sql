-- Les relances manuelles traitées par l'opérateur Ranti (ranti-ops,
-- table reminder_events) doivent apparaître sur l'écran Relances du
-- propriétaire. RLS était activé sans policy : la table était invisible
-- pour le client authentifié. Lecture seule, périmètre landlord —
-- même modèle que "Landlords see own reminders" (migration 019).
-- L'écriture reste réservée au service_role (ranti-ops).

drop policy if exists "Landlords see own reminder events" on public.reminder_events;

create policy "Landlords see own reminder events" on public.reminder_events
  for select
  to authenticated
  using (landlord_id = private.current_landlord_id());
