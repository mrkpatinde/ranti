-- Loyer et jour d'échéance par défaut sur le logement (ADR-016).
--
-- Le modèle de domaine (domain-model.md, décision 002) garde le BAIL comme
-- source de vérité : ce sont les colonnes du bail qui pilotent la génération
-- des échéances. Ces deux colonnes ne sont qu'un DÉFAUT de pré-remplissage :
-- sélectionner un logement dans le formulaire de bail propose son loyer et son
-- jour, l'utilisateur relit et confirme. Elles n'écrivent jamais d'échéance.
--
-- Nullable : un logement peut ne pas encore avoir de prix (chambre jamais
-- louée créée sans loyer). Les contraintes reprennent celles du bail.

alter table public.units
  add column if not exists default_rent_amount integer,
  add column if not exists default_due_day smallint;

alter table public.units
  drop constraint if exists units_default_rent_amount_positive,
  add constraint units_default_rent_amount_positive
    check (default_rent_amount is null or default_rent_amount > 0);

alter table public.units
  drop constraint if exists units_default_due_day_range,
  add constraint units_default_due_day_range
    check (default_due_day is null or (default_due_day >= 1 and default_due_day <= 31));

comment on column public.units.default_rent_amount is
  'Loyer par défaut (FCFA) proposé au formulaire de bail. Défaut de saisie, pas source de vérité — le bail reste maître (domain-model 002).';
comment on column public.units.default_due_day is
  'Jour d''échéance par défaut proposé au formulaire de bail. Défaut de saisie, pas source de vérité.';
