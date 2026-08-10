-- ============================================================
-- 20260809120000 — Retrait du rail de paiement custodial
-- ============================================================
-- Contexte : les CGU (art. 3) et la politique de confidentialité (art. 5)
-- affirment que Ranti ne reçoit, ne détient et ne transfère jamais les loyers,
-- et qu'aucun prestataire de paiement n'intervient. Le dépôt contenait
-- pourtant un webhook FeexPay actif, un ledger de commission 5 % et un split
-- de TVA à 18 %. ADR-024 exigeait leur mise hors service ; elle n'a jamais eu
-- lieu. Cette migration aligne la base sur le contrat.
--
-- L'encaissement reste non-custodial : le locataire paie directement sur
-- l'alias marchand du gestionnaire (landlords.payment_alias), qui n'est pas
-- touché ici. Ranti enregistre, rapproche et atteste — sans jamais être dans
-- la chaîne de paiement.
--
-- Réversible : l'historique git conserve les 5 migrations d'origine.
-- ============================================================

begin;

-- 1. RPC du rail (ingestion webhook, vérification, reversement).
drop function if exists public.ingest_payment_notification(text, text, integer, text, uuid, jsonb);
drop function if exists public.ingest_payment_notification(text, text, integer, text, uuid, jsonb, uuid);
drop function if exists public.verify_payment_transaction(uuid);
drop function if exists public.reject_payment_transaction(uuid, text);
drop function if exists public.mark_payment_transaction_paid_out(uuid);

-- Toute surcharge résiduelle portant ces noms (5 redéfinitions successives
-- dans l'historique : on ne se fie pas aux signatures figées).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proname in (
        'ingest_payment_notification', 'verify_payment_transaction',
        'reject_payment_transaction', 'mark_payment_transaction_paid_out'
      )
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

-- 2. Table du ledger de commission (0 ligne en production au 2026-08-09).
drop table if exists public.payment_transactions cascade;

-- 3. Justificatifs de paiement : table orpheline, aucun code applicatif ne la
--    lit ni ne l'écrit, 0 ligne en production.
drop table if exists public.payment_proofs cascade;

commit;
