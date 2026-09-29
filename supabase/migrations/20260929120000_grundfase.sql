-- Fase 2: grundfase
-- Tabeller til profiler, par, titler (cache fra TMDB), swipes, "ikke nu" og matches,
-- med Row Level Security, så en bruger kun kan se og ændre data for sit eget par.
--
-- Projektet er oprettet med "Automatically expose new tables" slået fra, så alle
-- rettigheder til rollen authenticated gives eksplicit med GRANT nedenfor.
-- Rollen anon får ingen rettigheder: man skal være logget ind for at bruge appen.

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  -- TMDB-id'er for de streamingtjenester, brugeren har valgt (region DK).
  providers integer[] not null default '{}',
  -- Om køen skal filtreres efter de valgte tjenester.
  filter_providers boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  -- Første version: præcis to personer. Kan hæves senere uden ændring af datamodellen.
  max_members smallint not null default 2 check (max_members >= 2),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  -- En bruger kan kun være med i ét par ad gangen.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

-- Titelcache. Udfyldes kun af Edge Functionen "tmdb" (med service role).
-- id har formen "movie-603" eller "tv-1399", fordi TMDB's id'er kun er unikke pr. type.
create table public.titles (
  id text primary key check (id ~ '^(movie|tv)-[0-9]+$'),
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  metadata jsonb not null,
  -- Egenskabsvektoren bygges i fase 3.
  features jsonb,
  fetched_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);

create table public.swipes (
  user_id uuid not null references auth.users (id) on delete cascade,
  title_id text not null references public.titles (id) on delete cascade,
  action text not null check (action in ('like', 'superlike', 'nope', 'seen')),
  -- Valgfri vurdering 1–5, kun ved "har set den".
  rating smallint check (rating between 1 and 5),
  -- Udfyldes i fase 3, når præferencemodellen findes.
  model_version text,
  predicted_prob real check (predicted_prob between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (user_id, title_id),
  check (rating is null or action = 'seen')
);

create table public.snoozed (
  user_id uuid not null references auth.users (id) on delete cascade,
  title_id text not null references public.titles (id) on delete cascade,
  until timestamptz not null,
  primary key (user_id, title_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title_id text not null references public.titles (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'unseen' check (status in ('unseen', 'seen')),
  seen_at timestamptz,
  -- Vurderinger 1–5 pr. medlem: {"<user_id>": 4, ...}. Sættes med rate_match().
  ratings jsonb not null default '{}',
  unique (couple_id, title_id)
);

create index swipes_title_idx on public.swipes (title_id);
create index matches_couple_idx on public.matches (couple_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Hjælpefunktioner (security definer, så RLS-reglerne ikke kalder sig selv i ring)
-- ---------------------------------------------------------------------------

create function public.my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

-- Er brugeren i samme par som den indloggede bruger (eller brugeren selv)?
create function public.is_partner(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select other = auth.uid() or exists (
    select 1
    from public.couple_members me
    join public.couple_members them on them.couple_id = me.couple_id
    where me.user_id = auth.uid() and them.user_id = other
  )
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.titles enable row level security;
alter table public.swipes enable row level security;
alter table public.snoozed enable row level security;
alter table public.matches enable row level security;

-- profiles: læs egen og partnerens, skriv kun egen.
create policy "profiles: læs eget par" on public.profiles
  for select to authenticated using (public.is_partner(id));
create policy "profiles: opret egen" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: ret egen" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- couples og couple_members: kun læsning af eget par. Oprettelse og tilmelding sker via funktioner.
create policy "couples: læs eget" on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy "couple_members: læs eget par" on public.couple_members
  for select to authenticated using (couple_id = public.my_couple_id());

-- titles: offentlige TMDB-data, som alle indloggede må læse. Ingen skriveregler (kun service role).
create policy "titles: læs" on public.titles
  for select to authenticated using (true);

-- swipes: læs egne og partnerens (bruges til matches og senere til køen), skriv kun egne.
create policy "swipes: læs eget par" on public.swipes
  for select to authenticated using (public.is_partner(user_id));
create policy "swipes: opret egne" on public.swipes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "swipes: ret egne" on public.swipes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "swipes: slet egne" on public.swipes
  for delete to authenticated using (user_id = (select auth.uid()));

-- snoozed: kun egne.
create policy "snoozed: egne" on public.snoozed
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- matches: læs og ret status for eget par. Oprettes kun af triggeren.
create policy "matches: læs eget par" on public.matches
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "matches: ret eget par" on public.matches
  for update to authenticated using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());

-- ---------------------------------------------------------------------------
-- Rettigheder
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.couples, public.couple_members, public.titles to authenticated;
grant select, insert, update, delete on public.swipes, public.snoozed to authenticated;
grant select on public.matches to authenticated;
-- Kun status må rettes direkte. Vurderinger sættes med rate_match(), så man ikke kan ændre partnerens.
grant update (status, seen_at) on public.matches to authenticated;

grant all on public.titles to service_role;
grant select on public.profiles, public.swipes, public.snoozed, public.couple_members to service_role;

revoke execute on function public.my_couple_id() from public, anon;
revoke execute on function public.is_partner(uuid) from public, anon;
grant execute on function public.my_couple_id() to authenticated;
grant execute on function public.is_partner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profil oprettes automatisk ved første login
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Parkobling
-- ---------------------------------------------------------------------------

-- Opretter et par med den indloggede bruger som første medlem og returnerer invitationskoden.
create function public.create_couple()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Uden 0/O og 1/I/L, så koden er let at læse op og taste.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Du skal være logget ind.';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Du er allerede med i et par.';
  end if;

  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.couples where invite_code = code);
  end loop;

  insert into public.couples (invite_code, created_by) values (code, auth.uid()) returning id into new_id;
  insert into public.couple_members (couple_id, user_id) values (new_id, auth.uid());
  return code;
end;
$$;

-- Kobler den indloggede bruger på parret med den givne invitationskode.
create function public.join_couple(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.couples;
begin
  if auth.uid() is null then
    raise exception 'Du skal være logget ind.';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Du er allerede med i et par.';
  end if;

  select * into c from public.couples where invite_code = upper(trim(code)) for update;
  if not found then
    raise exception 'Invitationskoden findes ikke.';
  end if;
  if (select count(*) from public.couple_members where couple_id = c.id) >= c.max_members then
    raise exception 'Parret er allerede fuldt.';
  end if;

  insert into public.couple_members (couple_id, user_id) values (c.id, auth.uid());
  return c.id;
end;
$$;

-- Forlader parret. Er man den sidste, slettes parret med dets matches.
create function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  delete from public.couple_members where user_id = auth.uid() returning couple_id into cid;
  if cid is not null and not exists (select 1 from public.couple_members where couple_id = cid) then
    delete from public.couples where id = cid;
  end if;
end;
$$;

revoke execute on function public.create_couple() from public, anon;
revoke execute on function public.join_couple(text) from public, anon;
revoke execute on function public.leave_couple() from public, anon;
grant execute on function public.create_couple() to authenticated;
grant execute on function public.join_couple(text) to authenticated;
grant execute on function public.leave_couple() to authenticated;

-- ---------------------------------------------------------------------------
-- Match-trigger: når alle i parret har liket (eller superliket) samme titel
-- ---------------------------------------------------------------------------

create function public.create_match_on_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  members int;
  likers int;
begin
  if new.action not in ('like', 'superlike') then
    return new;
  end if;

  select couple_id into cid from public.couple_members where user_id = new.user_id;
  if cid is null then
    return new;
  end if;

  select count(*) into members from public.couple_members where couple_id = cid;
  select count(*) into likers
  from public.couple_members m
  join public.swipes s on s.user_id = m.user_id and s.title_id = new.title_id
  where m.couple_id = cid and s.action in ('like', 'superlike');

  if members >= 2 and likers = members then
    insert into public.matches (couple_id, title_id) values (cid, new.title_id)
    on conflict (couple_id, title_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger swipes_create_match
  after insert or update of action on public.swipes
  for each row execute function public.create_match_on_like();

-- ---------------------------------------------------------------------------
-- Vurdering af et match
-- ---------------------------------------------------------------------------

create function public.rate_match(match_id uuid, rating smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if rating is not null and rating not between 1 and 5 then
    raise exception 'Vurderingen skal være mellem 1 og 5.';
  end if;

  update public.matches
  set ratings = case
        when rating is null then ratings - auth.uid()::text
        else ratings || jsonb_build_object(auth.uid()::text, rating)
      end,
      status = case when rating is null then status else 'seen' end,
      seen_at = case when rating is null then seen_at else coalesce(seen_at, now()) end
  where id = match_id and couple_id = public.my_couple_id();

  if not found then
    raise exception 'Matchet findes ikke.';
  end if;
end;
$$;

revoke execute on function public.rate_match(uuid, smallint) from public, anon;
grant execute on function public.rate_match(uuid, smallint) to authenticated;

-- Triggerfunktionerne må ikke kaldes direkte via API'et.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_match_on_like() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: nye og ændrede matches sendes til begge telefoner (RLS gælder også her)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.matches;
