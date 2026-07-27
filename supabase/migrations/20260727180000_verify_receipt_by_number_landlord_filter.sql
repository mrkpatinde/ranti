-- ============================================================
-- Lever l'ambiguïté des références RNT : second critère, le nom du bailleur
--
-- La séquence RNT repart à 0001 par bailleur et par année. Ce n'est plus une
-- projection : la production porte DÉJÀ deux `RNT-2026-0001`, et la recherche
-- par référence — le seul chemin dont dispose un locataire qui tient une
-- quittance imprimée, sans QR scannable — répondait « plusieurs documents
-- portent cette référence » sur le numéro le plus courant qui soit.
--
-- Décision (2026-07-27) : ajouter un second critère de recherche plutôt que de
-- changer le format imprimé. Un discriminant dans la référence n'aurait soigné
-- que les documents FUTURS ; les quittances déjà en circulation seraient
-- restées ambiguës à vie. Ce sont précisément celles qu'un locataire présente
-- aujourd'hui.
--
-- Le paramètre est OPTIONNEL (défaut null) : une référence non ambiguë se
-- vérifie toujours avec le seul numéro, l'UI ne demande le nom que lorsqu'elle
-- a reçu un verdict ambigu.
--
-- Portée de la divulgation — inchangée. Le retour ne gagne AUCUN champ : ni
-- nom, ni logement, ni montant, ni empreinte. Le nom est un FILTRE d'entrée,
-- jamais une sortie. Un appelant peut donc tester des couples (numéro, nom),
-- mais il n'apprend rien de plus qu'en scannant le QR imprimé sur le document
-- qu'il aurait de toute façon en main. Le risque d'énumération reste celui,
-- déjà accepté, du numéro séquentiel (TODOS : rate limit WAF quand le trafic
-- le justifiera).
--
-- Correspondance volontairement tolérante : le locataire tape ce qu'il lit sur
-- la quittance, souvent le seul nom de famille, avec une casse quelconque.
-- On compare en minuscules sur « prénom nom » ET sur le nom seul, en
-- sous-chaîne. Trop strict = on remplace une impasse par une autre.
--
-- Signature modifiée (1 -> 2 arguments) : drop + recreate + regrant. Le type
-- de retour, lui, ne bouge pas.
-- ============================================================

begin;

drop function if exists public.verify_receipt_by_number(text);

create function public.verify_receipt_by_number(
  p_number text,
  p_landlord_name text default null
)
returns table (
  match_count integer,
  receipt_number text,
  kind text,
  status text,
  issued_at timestamptz,
  periods jsonb,
  integrity text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_number text := upper(trim(p_number));
  v_name text := nullif(lower(btrim(coalesce(p_landlord_name, ''))), '');
  v_rows public.receipts[];
  v public.receipts%rowtype;
  v_integrity text;
begin
  if v_number is null or v_number !~ '^RNT-\d{4}-\d{4,}$' then
    return; -- format invalide -> introuvable, sans détail
  end if;

  -- Une seule passe : limit 2 suffit à distinguer unique / ambigu.
  -- Le filtre nom ne s'applique que s'il est fourni (jointure sur landlords).
  select coalesce(array_agg(r), '{}') into v_rows
  from (
    select rc.*
    from public.receipts rc
    join public.landlords l on l.id = rc.landlord_id
    where rc.receipt_number = v_number
      and rc.deleted_at is null
      and (
        v_name is null
        or lower(btrim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))) like '%' || v_name || '%'
        or lower(btrim(coalesce(l.last_name, ''))) like '%' || v_name || '%'
      )
    limit 2
  ) r;

  if array_length(v_rows, 1) is null then
    return; -- aucun document
  end if;

  if array_length(v_rows, 1) > 1 then
    -- Toujours ambigu : soit le nom n'a pas été fourni, soit il ne discrimine
    -- pas. match_count = 2 vaut « plusieurs », le nombre exact reste tu.
    return query
    select 2, null::text, null::text, null::text, null::timestamptz,
           null::jsonb, null::text;
    return;
  end if;

  v := v_rows[1];

  -- Verdict calculé ici, empreintes jamais renvoyées sur ce chemin énumérable.
  if v.status = 'cancelled' then
    v_integrity := 'cancelled';
  elsif v.sha256_fingerprint is null or btrim(v.sha256_fingerprint) = '' then
    v_integrity := 'unsealed';
  elsif private.receipt_computed_fingerprint(v.receipt_number, v.issued_at, v.snapshot)
        = v.sha256_fingerprint then
    v_integrity := 'verified';
  else
    v_integrity := 'tampered';
  end if;

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
    v_integrity;
end;
$$;

revoke all on function public.verify_receipt_by_number(text, text) from public;
grant execute on function public.verify_receipt_by_number(text, text) to anon, authenticated;

commit;
