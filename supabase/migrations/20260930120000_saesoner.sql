-- Sæsoner ved "har set den" for serier.
-- seasons_seen er de sæsonnumre, brugeren har set (fx {1,2,3}).
-- all_seasons betyder, at brugeren har set alle sæsoner, der fandtes, da det blev angivet.

alter table public.swipes
  add column seasons_seen smallint[],
  add column all_seasons boolean not null default false,
  add constraint swipes_seasons_only_when_seen
    check ((seasons_seen is null and not all_seasons) or action = 'seen'),
  add constraint swipes_seasons_positive
    check (seasons_seen is null or 0 < all (seasons_seen));
