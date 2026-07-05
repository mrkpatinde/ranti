-- Test : get_rent_due_by_token expose l'alias PI-SPI du propriétaire, et la
-- contrainte de type est appliquée. Transaction ROLLBACK — aucun effet
-- persistant. Crée une échéance synthétique sur le bail le plus récent puis
-- vérifie : alias renvoyé quand présent ; null quand effacé ; type invalide rejeté.
begin;
do $$
declare
  v_model record;
  v_due_id uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_row record;
begin
  select rd.* into v_model from rent_dues rd order by rd.created_at desc limit 1;
  if v_model.id is null then raise exception 'SETUP: no model due'; end if;

  update landlords
    set payment_alias = '0197000000', payment_alias_type = 'phone'
    where id = v_model.landlord_id;

  insert into rent_dues (id, landlord_id, lease_id, tenant_id, unit_id, period_start, period_end,
    due_date, amount_due, currency, status, confirmation_token)
  values (v_due_id, v_model.landlord_id, v_model.lease_id, v_model.tenant_id, v_model.unit_id,
    '2026-09-01', '2026-09-30', '2026-09-05', 50000, 'XOF', 'expected', v_token);

  -- Alias présent -> renvoyé avec son type.
  select * into v_row from public.get_rent_due_by_token(v_token);
  if v_row.landlord_payment_alias <> '0197000000' then
    raise exception 'FAIL alias: %', v_row.landlord_payment_alias;
  end if;
  if v_row.landlord_payment_alias_type <> 'phone' then
    raise exception 'FAIL alias_type: %', v_row.landlord_payment_alias_type;
  end if;

  -- Alias effacé -> null (pas d'affichage côté locataire).
  update landlords set payment_alias = null, payment_alias_type = null
    where id = v_model.landlord_id;
  select * into v_row from public.get_rent_due_by_token(v_token);
  if v_row.landlord_payment_alias is not null then
    raise exception 'FAIL alias not cleared: %', v_row.landlord_payment_alias;
  end if;

  -- Type hors ('phone','address') rejeté par la contrainte.
  begin
    update landlords set payment_alias_type = 'crypto' where id = v_model.landlord_id;
    raise exception 'FAIL: invalid alias type accepted';
  exception when check_violation then null;
  end;

  raise notice 'ALL OK';
end $$;
rollback;
