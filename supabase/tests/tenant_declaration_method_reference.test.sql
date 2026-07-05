-- Tests déclaration locataire avec moyen + référence (transaction ROLLBACK —
-- aucun effet persistant). Crée une échéance synthétique août 2026 sur le
-- bail le plus récent, puis vérifie :
--   méthode invalide refusée ; déclaration ok (method, référence trimée,
--   recorded_by='tenant', montant = montant du bail) ; double déclaration bloquée.
begin;
do $$
declare
  v_model record;
  v_due_id uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_res text;
  v_rec record;
begin
  select rd.* into v_model from rent_dues rd order by rd.created_at desc limit 1;
  if v_model.id is null then raise exception 'SETUP: no model due'; end if;

  insert into rent_dues (id, landlord_id, lease_id, tenant_id, unit_id, period_start, period_end,
    due_date, amount_due, currency, status, confirmation_token)
  values (v_due_id, v_model.landlord_id, v_model.lease_id, v_model.tenant_id, v_model.unit_id,
    '2026-08-01', '2026-08-31', '2026-08-05', 50000, 'XOF', 'expected', v_token);

  v_res := public.declare_rent_payment_by_token(v_token, 'chèque', null);
  if v_res <> 'method_invalid' then raise exception 'FAIL method_invalid: %', v_res; end if;

  v_res := public.declare_rent_payment_by_token(v_token, 'mobile_money', ' MM-12345 ');
  if v_res <> 'ok' then raise exception 'FAIL ok: %', v_res; end if;

  select rr.* into v_rec from rent_receptions rr
  join rent_reception_allocations a on a.rent_reception_id = rr.id
  where a.rent_due_id = v_due_id and rr.status = 'draft'
  limit 1;
  if v_rec.payment_method <> 'mobile_money' then raise exception 'FAIL method: %', v_rec.payment_method; end if;
  if v_rec.payment_reference <> 'MM-12345' then raise exception 'FAIL ref: %', v_rec.payment_reference; end if;
  if v_rec.recorded_by <> 'tenant' then raise exception 'FAIL recorded_by: %', v_rec.recorded_by; end if;
  if v_rec.amount_received <> 50000 then raise exception 'FAIL amount: %', v_rec.amount_received; end if;

  v_res := public.declare_rent_payment_by_token(v_token, 'cash', null);
  if v_res <> 'already_declared' then raise exception 'FAIL dup: %', v_res; end if;

  raise notice 'ALL OK';
end $$;
rollback;
