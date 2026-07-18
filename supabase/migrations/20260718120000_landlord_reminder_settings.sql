-- Reglages de relance par proprietaire (prototype FirstRun, modale Relance +
-- vues Relances / Parametres). Le prototype tient relanceActive / relCanal /
-- relMoment en etat client ; ici on les persiste pour qu'ils survivent a une
-- deconnexion ou un changement d'appareil.
--
-- Colonnes NON-identite : le trigger `landlords_identity_lock` ne se declenche
-- que sur UPDATE OF first_name, last_name, civility, phone (ADR-002), donc un
-- update de ces colonnes ne le reveille pas. La policy `landlords_update_own`
-- autorise deja `authenticated` a ecrire sa propre ligne (meme chemin que
-- payment_alias / onboarding_status). Aucun RPC requis.
--
-- Portee MINIMALE (decision produit 2026-07-18) : on PERSISTE le reglage et on
-- le reflete dans l'UI. Le RESPECT cote serveur (filtrer ops_reminder_queue sur
-- reminders_enabled / reminder_moment) touche la logique de relance ADR-023
-- gelee : reporte a une revue eng dediee, pas fait ici.
--
-- Valeurs :
--   reminders_enabled  false par defaut (relance auto desactivee tant que non
--                      activee explicitement).
--   reminder_channel   whatsapp | sms (null = non configure, l'UI retombe sur
--                      whatsapp).
--   reminder_moment    avant (3 j avant l'echeance) | echeance (le jour) |
--                      retard (en cas de retard). null = non configure, l'UI
--                      retombe sur echeance.

begin;

alter table public.landlords
  add column if not exists reminders_enabled boolean not null default false,
  add column if not exists reminder_channel text,
  add column if not exists reminder_moment text;

alter table public.landlords
  drop constraint if exists landlords_reminder_channel_check;
alter table public.landlords
  add constraint landlords_reminder_channel_check
  check (reminder_channel is null or reminder_channel in ('whatsapp', 'sms'));

alter table public.landlords
  drop constraint if exists landlords_reminder_moment_check;
alter table public.landlords
  add constraint landlords_reminder_moment_check
  check (reminder_moment is null or reminder_moment in ('avant', 'echeance', 'retard'));

comment on column public.landlords.reminders_enabled is
  'Relance automatique activee (FirstRun). Persistance seule ; l''application '
  'cote file de relance (ops_reminder_queue, ADR-023 gele) est un suivi.';
comment on column public.landlords.reminder_channel is
  'Canal de relance prefere : whatsapp|sms. null = defaut UI (whatsapp).';
comment on column public.landlords.reminder_moment is
  'Moment de relance : avant|echeance|retard. null = defaut UI (echeance).';

commit;
