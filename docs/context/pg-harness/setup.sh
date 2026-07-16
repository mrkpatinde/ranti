#!/bin/bash
# Harnais de validation local des migrations Ranti (Postgres 16 + shims Supabase).
mkdir -p /tmp/pg-harness-logs
# Usage: setup.sh          -> cluster neuf + toutes les migrations du repo
set -e
PGBIN=/usr/lib/postgresql/16/bin
BASE=/var/lib/postgresql/ranti-harness
ERRDIR=/tmp/pg-harness-logs
DATA=$BASE/data
SOCK=$BASE/sock
PORT=55432
REPO=/home/user/ranti

# 0. Stop any previous cluster, wipe
sudo -u postgres $PGBIN/pg_ctl -D "$DATA" stop -m immediate 2>/dev/null || true
rm -rf "$DATA" "$SOCK"
mkdir -p "$DATA" "$SOCK"
chown -R postgres:postgres "$BASE"
chmod 755 $BASE

# 1. Fake pg_cron extension (schedule() shim only — no background worker)
cat > /usr/share/postgresql/16/extension/pg_cron.control <<'EOF'
comment = 'pg_cron shim for local migration testing'
default_version = '1.6'
relocatable = false
schema = pg_catalog
EOF
cat > "/usr/share/postgresql/16/extension/pg_cron--1.6.sql" <<'EOF'
create schema if not exists cron;
create sequence cron.jobid_seq;
create table cron.job (
  jobid bigint primary key default nextval('cron.jobid_seq'),
  jobname text unique,
  schedule text not null,
  command text not null
);
create function cron.schedule(job_name text, schedule text, command text)
returns bigint language plpgsql as $fn$
declare v_id bigint;
begin
  insert into cron.job (jobname, schedule, command)
  values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v_id;
  return v_id;
end $fn$;
create function cron.unschedule(job_name text)
returns boolean language sql as $fn$
  delete from cron.job where jobname = job_name returning true;
$fn$;
EOF

# 2. Init + start
sudo -u postgres $PGBIN/initdb -D "$DATA" -E UTF8 --locale=C.UTF-8 >/dev/null
sudo -u postgres $PGBIN/pg_ctl -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l $BASE/pg.log start >/dev/null
export PGHOST=$SOCK PGPORT=$PORT PGUSER=postgres

# 3. Supabase shims: roles + auth schema
psql -d postgres -v ON_ERROR_STOP=1 -q <<'EOF'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create database ranti_test;
EOF
psql -d ranti_test -v ON_ERROR_STOP=1 -q <<'EOF'
create schema auth;
create table auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
EOF

# 4. Apply all repo migrations in supabase (lexicographic) order
fail=0
for f in $(ls "$REPO/supabase/migrations" | sort); do
  if ! psql -d ranti_test -v ON_ERROR_STOP=1 -q -f "$REPO/supabase/migrations/$f" >/dev/null 2>"$ERRDIR/last_err"; then
    echo "MIGRATION FAILED: $f"; cat "$ERRDIR/last_err"; fail=1; break
  fi
done
[ $fail -eq 0 ] && echo "ALL MIGRATIONS APPLIED"
