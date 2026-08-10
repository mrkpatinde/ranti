-- ============================================================
-- 20260809120400 — Réconciliation continue des deux comptabilités
-- ============================================================
-- La migration 20260716150000 a introduit public.transactions (grand livre)
-- en phase « expand », alimenté par trois triggers miroirs depuis le modèle
-- historique (rent_dues / rent_receptions / rent_reception_allocations). La
-- phase « contract » n'a jamais eu lieu : les deux modèles coexistent, et le
-- tableau de bord interroge les deux sur la même page.
--
-- Le garde-fou private.verify_ledger_equality() existe déjà mais n'a été
-- exécuté qu'une seule fois, dans le bloc DO de sa propre migration. Une
-- divergence apparue après déploiement est donc silencieuse : le solde
-- affiché peut cesser de correspondre au solde réel sans qu'aucun signal ne
-- soit émis.
--
-- Cette migration ne supprime pas le doublon — la bascule est un chantier à
-- part entière. Elle le rend observable : contrôle quotidien, historique
-- conservé, divergence visible en une requête.
-- ============================================================

begin;

create table if not exists private.ledger_health (
  checked_at        timestamptz primary key default now(),
  diverging_leases  integer not null,
  detail            jsonb   not null default '[]'::jsonb
);

revoke all on private.ledger_health from public, anon, authenticated;

comment on table private.ledger_health is
  'Historique du contrôle d''égalité entre le modèle historique (rent_dues) et
   le grand livre (transactions). diverging_leases > 0 = incident comptable.';

create or replace function private.check_ledger_health()
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_detail jsonb;
  v_count  integer;
begin
  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb), count(*)
  into v_detail, v_count
  from private.verify_ledger_equality() d;

  insert into private.ledger_health (checked_at, diverging_leases, detail)
  values (now(), v_count, v_detail);

  if v_count > 0 then
    raise warning 'Grand livre : % bail(s) en divergence — %', v_count, v_detail;
  end if;

  return v_count;
end;
$$;

revoke all on function private.check_ledger_health() from public, anon, authenticated;

-- Vue d'exploitation : dernier contrôle et son verdict.
create or replace view public.ops_ledger_health as
select
  h.checked_at,
  h.diverging_leases,
  h.diverging_leases = 0 as healthy,
  h.detail
from private.ledger_health h
order by h.checked_at desc
limit 30;

revoke all on public.ops_ledger_health from anon, authenticated;
grant select on public.ops_ledger_health to service_role;

-- Contrôle quotidien à 03h10 UTC. pg_cron est déjà utilisé par la migration
-- 011 pour le marquage des retards ; on réutilise le même mécanisme.
do $$
begin
  perform cron.schedule(
    'ranti-ledger-health',
    '10 3 * * *',
    $cron$select private.check_ledger_health();$cron$
  );
exception when others then
  raise notice 'pg_cron indisponible, contrôle du grand livre non planifié : %', sqlerrm;
end $$;

-- Première mesure immédiate : sert de référence.
do $$
declare n integer;
begin
  select private.check_ledger_health() into n;
  raise notice 'Contrôle initial du grand livre : % divergence(s)', n;
end $$;

commit;
