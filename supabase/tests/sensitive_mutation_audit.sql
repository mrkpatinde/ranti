-- Test SQL transactionnel — ADR-006 (audit des mutations sensibles).
-- Smoke test local : vérifie que les primitives d'audit existent et que les
-- écritures directes côté authenticated restent interdites par absence de policy.
-- Le test métier complet doit être exécuté localement avec des données jetables.

begin;

do $$
declare
  n int;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'private'
    and p.proname = 'write_audit'
    and p.pronargs = 6;
  if n <> 1 then
    raise exception 'write_audit missing' using errcode='90001';
  end if;

  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename = 'audit_logs'
    and cmd in ('INSERT', 'UPDATE', 'DELETE');
  if n <> 0 then
    raise exception 'audit_logs has mutation policy count=%', n using errcode='90001';
  end if;

  select count(*) into n
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'audit_logs'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if n <> 0 then
    raise exception 'audit_logs mutation grants count=%', n using errcode='90001';
  end if;

  raise notice 'OK ADR-006 audit smoke test';
end $$;

rollback;
