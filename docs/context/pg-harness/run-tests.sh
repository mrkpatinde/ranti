#!/bin/bash
# Exécute les tests SQL du repo contre le cluster harnais. $1 = filtre optionnel.
BASE=/var/lib/postgresql/ranti-harness
export PGHOST=$BASE/sock PGPORT=55432 PGUSER=postgres
REPO=/home/user/ranti
ERRDIR=/tmp/pg-harness-logs
pass=0; failed=0
for f in $(ls "$REPO/supabase/tests" | sort); do
  case "$f" in *"${1:-}"*) ;; *) continue;; esac
  if psql -d ranti_test -v ON_ERROR_STOP=1 -q -f "$REPO/supabase/tests/$f" >"$ERRDIR/test_out" 2>&1; then
    echo "PASS $f"; pass=$((pass+1))
  else
    echo "FAIL $f"; tail -4 "$ERRDIR/test_out" | sed 's/^/     /'; failed=$((failed+1))
  fi
done
echo "== $pass pass, $failed fail"
