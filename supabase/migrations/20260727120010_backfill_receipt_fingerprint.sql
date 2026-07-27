-- ============================================================
-- Rétro-scellement des documents émis AVANT le scellement à l'émission
--
-- Migration délibérément SÉPARÉE de 20260727120000 : sceller à l'émission est
-- une correction mécanique, rétro-sceller est une DÉCISION. Cette migration
-- peut être retirée sans rien casser — les documents concernés resteraient
-- simplement `unsealed` sur /verifier, et seraient scellés à la première
-- certification locataire.
--
-- CE QUE CE RÉTRO-SCELLEMENT PROUVE : que le contenu figé (receipt_number,
-- issued_at, snapshot) de ces documents n'a pas bougé DEPUIS AUJOURD'HUI.
--
-- CE QU'IL NE PROUVE PAS : quoi que ce soit sur la période entre leur émission
-- et aujourd'hui. Un snapshot altéré avant cette migration serait scellé tel
-- quel, et sortirait « Intégrité vérifiée ». Ne pas présenter ces documents
-- comme scellés à l'émission.
--
-- Pourquoi c'est acceptable ici : la base de production ne porte que des
-- données de test (ADR-024 : 1 propriétaire de test, 0 transaction). Si ce
-- n'était plus le cas au moment d'appliquer, NE PAS APPLIQUER cette migration.
--
-- Le trigger receipts_audit (`after insert or update`) tracera ces écritures :
-- c'est voulu — une mutation de la table de preuve doit rester lisible dans
-- l'audit. actor_landlord_id sera null (aucune session utilisateur).
-- Le trigger trg_audit_receipts_sensitive ne se déclenche pas : il n'écoute
-- que status / cancelled_at / cancellation_reason / replaces_receipt_id.
-- ============================================================

begin;

update public.receipts
set sha256_fingerprint =
      private.receipt_computed_fingerprint(receipt_number, issued_at, snapshot)
where sha256_fingerprint is null
  and deleted_at is null;

commit;
