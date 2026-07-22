-- ============================================================
-- Vérification stricte d'intégrité du reçu (page publique /verifier)
--
-- Jusqu'ici /verifier affichait « Document authentique » sur la seule
-- EXISTENCE de la ligne : l'empreinte SHA-256 imprimée n'était comparée à
-- rien, et la mention « n'a pas été modifié depuis » n'était adossée à aucun
-- calcul. Cette RPC recalcule l'empreinte avec l'EXACTE même expression que
-- certify_receipt_by_token (ADR-013) et la renvoie À CÔTÉ de l'empreinte
-- stockée. La page compare les deux : intègre / altéré / non scellé.
--
-- SECURITY DEFINER, clé sur l'id (UUID non devinable, comme le QR imprimé sur
-- le PDF). Ne renvoie AUCUN montant : la page publique n'expose que
-- l'authenticité. L'anon ne lit aucune table en direct. Idempotent.
-- ============================================================

BEGIN;

create or replace function public.verify_receipt_integrity(p_id uuid)
returns table (
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  tenant_first_name text,
  tenant_last_name text,
  unit_name text,
  allocations jsonb,
  tenant_ack text,
  stored_fingerprint text,
  computed_fingerprint text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.receipts%rowtype;
begin
  select * into v
  from public.receipts
  where id = p_id and deleted_at is null;

  if not found then
    return; -- aucune ligne -> la page rend un 404
  end if;

  return query
  select
    v.receipt_number,
    v.kind,
    v.status,
    v.issued_at,
    v.snapshot -> 'tenant' ->> 'first_name',
    v.snapshot -> 'tenant' ->> 'last_name',
    v.snapshot -> 'unit' ->> 'name',
    coalesce(v.snapshot -> 'allocations', '[]'::jsonb),
    v.tenant_ack,
    v.sha256_fingerprint,
    -- Recalcul avec l'EXACTE même entrée que certify_receipt_by_token :
    -- receipt_number + issued_at (UTC déterministe) + snapshot::text. Toute
    -- divergence avec sha256_fingerprint = contenu altéré après certification.
    -- Le recalcul reste ici (SQL) car snapshot::text n'est reproductible
    -- nulle part ailleurs à l'octet près.
    encode(
      digest(
        convert_to(
          v.receipt_number
            || to_char(v.issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
            || v.snapshot::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
end;
$$;

revoke all on function public.verify_receipt_integrity(uuid) from public;
grant execute on function public.verify_receipt_integrity(uuid) to anon, authenticated;

COMMIT;
