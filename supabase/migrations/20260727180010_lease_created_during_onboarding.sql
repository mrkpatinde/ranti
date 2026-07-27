-- ============================================================
-- Marquer le bail créé pendant la prise en main guidée
--
-- Le parcours /first-run distingue un bail « principal » (celui créé pendant
-- l'accueil) de bails « ajoutés » ensuite. Cette distinction ne vivait QUE
-- dans la mémoire du navigateur : rien en base ne disait lequel était le
-- principal. Conséquence — un bailleur qui rechargeait /first-run retrouvait
-- un écran vide alors que son bail existait, et pouvait le ressaisir : doublon
-- de logement et de locataire sur son tout premier contact avec le produit.
--
-- Décision (2026-07-27) : persister le marqueur plutôt que de le déduire.
-- L'alternative « le plus ancien bail est le principal » est vraie aujourd'hui
-- mais devient fausse dès que ce bail est archivé — et l'archivage d'un bail
-- est une opération normale, pas un cas limite.
--
-- Colonne non-identité, non financière : aucun RPC requis, l'écriture passe
-- par la policy leases_update_own comme les autres champs éditables. Défaut
-- false : tous les baux existants sont considérés « ajoutés », ce qui est le
-- comportement sûr (aucun n'est promu principal à tort).
-- ============================================================

begin;

alter table public.leases
  add column if not exists created_during_onboarding boolean not null default false;

comment on column public.leases.created_during_onboarding is
  'true = bail créé par le parcours guidé /first-run. Sert uniquement à '
  'reconstituer l''écran de prise en main après un rechargement. Aucune portée '
  'métier, financière ni juridique.';

-- Index partiel : la requête d'hydratation cherche LE bail marqué d'un
-- bailleur. Sans index, elle balaie tous ses baux ; avec, elle touche au plus
-- une poignée de lignes (un bailleur n'a qu'un bail d'onboarding).
create index if not exists leases_onboarding_idx
  on public.leases (landlord_id)
  where created_during_onboarding and deleted_at is null;

commit;
