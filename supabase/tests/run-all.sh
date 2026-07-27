#!/usr/bin/env bash
# Rejoue toute la suite SQL de supabase/tests contre la base LOCALE.
#
# Chaque test est transactionnel et se termine par ROLLBACK : aucun effet
# persistant. Le conteneur ciblé est celui de `supabase db start` — ce script
# ne sait pas parler à la prod, et ne doit jamais apprendre.
#
# Local :
#   supabase db start && supabase db reset
#   supabase/tests/run-all.sh
#
# CI : .github/workflows/ci.yml, job `db`.
#
# Pourquoi un script plutôt qu'une boucle dans le YAML : la même commande doit
# tourner sur un poste de dev et sur le runner. Deux copies divergent.
#
# Le verdict vient du CODE DE SORTIE de psql sous `ON_ERROR_STOP=1` (0 = OK,
# 3 = erreur de script), jamais d'un grep sur « ERROR » : plusieurs tests
# impriment légitimement le mot dans un message de garde-fou.

set -uo pipefail

cd "$(dirname "$0")/../.."

container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -1)"
if [ -z "$container" ]; then
  echo "Aucun conteneur supabase_db_* actif. Lancer d'abord : supabase db start" >&2
  exit 1
fi

echo "Base ciblée : $container"
echo

failed=0
total=0

for t in supabase/tests/*.sql; do
  [ -e "$t" ] || continue
  total=$((total + 1))
  name="$(basename "$t")"

  if output="$(docker exec -i "$container" psql -U postgres -d postgres \
      -v ON_ERROR_STOP=1 < "$t" 2>&1)"; then
    echo "OK      $name"
  else
    failed=$((failed + 1))
    echo "ECHEC   $name"
    printf '%s\n' "$output" | sed 's/^/        /'
  fi
done

echo
if [ "$failed" -gt 0 ]; then
  echo "$failed/$total test(s) SQL en echec."
  exit 1
fi

echo "$total/$total tests SQL OK."
