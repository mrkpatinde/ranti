-- ============================================================
-- Vérification publique par NUMÉRO de document (RNT-AAAA-NNNN)
--
-- Besoin produit : le propriétaire comme le locataire doivent pouvoir
-- retrouver le verdict d'authenticité d'une quittance à partir de la seule
-- référence imprimée (sans le QR ni le lien).
--
-- Surface volontairement PLUS pauvre que verify_receipt_integrity (UUID) :
-- le numéro est séquentiel donc énumérable, contrairement à l'UUID du QR.
-- Cette RPC ne renvoie ni nom, ni logement, ni montant : uniquement le type,
-- le numéro, la date d'émission, les périodes (sans montants), l'état
-- d'acquittement et les empreintes (stockée + recalculée).
--
-- Le numéro n'est unique que par propriétaire (unique(landlord_id,
-- receipt_number)) : en cas d'homonymie inter-propriétaires, la RPC renvoie
-- match_count > 1 et AUCUN détail ; la page invite à passer par le lien/QR.
--
-- SECURITY DEFINER ; l'anon ne lit aucune table en direct. Idempotent.
-- ============================================================

begin;

create or replace function public.verify_receipt_by_number(p_number text)
returns table (
  match_count integer,
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  periods jsonb,
  tenant_ack text,
  stored_fingerprint text,
  computed_fingerprint text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_number text := upper(trim(p_number));
  v_count integer;
  v public.receipts%rowtype;
begin
  if v_number is null or v_number !~ '^RNT-\d{4}-\d{4,}$' then
    return; -- format invalide -> introuvable, sans détail
  end if;

  select count(*) into v_count
  from public.receipts r
  where r.receipt_number = v_number and r.deleted_at is null;

  if v_count = 0 then
    return;
  end if;

  if v_count > 1 then
    -- Ambigu (numéros par propriétaire) : aucun détail, la page explique.
    return query
    select v_count, null::text, null::text, null::text, null::timestamptz,
           null::jsonb, null::text, null::text, null::text;
    return;
  end if;

  select * into v
  from public.receipts r
  where r.receipt_number = v_number and r.deleted_at is null;

  return query
  select
    1,
    v.receipt_number,
    v.kind,
    v.status,
    v.issued_at,
    -- Périodes seules : les montants ne sortent jamais par ce chemin.
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'period_start', a ->> 'period_start',
        'period_end', a ->> 'period_end'
      ))
      from jsonb_array_elements(coalesce(v.snapshot -> 'allocations', '[]'::jsonb)) a
    ), '[]'::jsonb),
    v.tenant_ack,
    v.sha256_fingerprint,
    -- Même recalcul que verify_receipt_integrity / certify_receipt_by_token.
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

revoke all on function public.verify_receipt_by_number(text) from public;
grant execute on function public.verify_receipt_by_number(text) to anon, authenticated;

commit;
