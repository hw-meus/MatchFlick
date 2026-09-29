-- Test af Row Level Security og matchtrigger.
--
-- Opretter to par (A og B) og en enlig bruger (C) og kontrollerer, at ingen kan læse
-- eller ændre data fra et andet par. Hele testen kører i én transaktion, som rulles
-- tilbage til sidst, så den kan køres mod den rigtige database uden at efterlade data.
--
-- Kør i Supabases SQL-editor eller med `npm run test:rls` (se README).
-- Testen stopper med en fejl, der starter med "FEJL:", hvis en regel ikke holder.
-- Ellers slutter den med beskeden "RLS-test bestået".

begin;

-- Faste test-id'er, så de er lette at genkende.
select set_config('t.a1', '00000000-0000-4000-a000-0000000000a1', true),
       set_config('t.a2', '00000000-0000-4000-a000-0000000000a2', true),
       set_config('t.b1', '00000000-0000-4000-a000-0000000000b1', true),
       set_config('t.b2', '00000000-0000-4000-a000-0000000000b2', true),
       set_config('t.c',  '00000000-0000-4000-a000-00000000000c', true);

insert into auth.users (id, email, aud, role)
select current_setting('t.' || k)::uuid, 'rls-test-' || k || '@example.invalid', 'authenticated', 'authenticated'
from unnest(array['a1', 'a2', 'b1', 'b2', 'c']) as k;

insert into public.titles (id, tmdb_id, media_type, metadata) values
  ('movie-900000001', 900000001, 'movie', '{"title": "Testfilm 1"}'),
  ('movie-900000002', 900000002, 'movie', '{"title": "Testfilm 2"}');

-- Skifter til en bestemt bruger, som PostgREST ville gøre det ud fra brugerens JWT.
create function pg_temp.login(k text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.' || k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'none', true);
end $$;

-- Tjekker en betingelse og stopper testen med en forklaring, hvis den ikke holder.
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FEJL: %', msg;
  end if;
  raise notice 'ok: %', msg;
end $$;

-- Kører en SQL-sætning og tjekker, at den bliver afvist.
create function pg_temp.assert_denied(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok: % (afvist: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FEJL: % – sætningen blev ikke afvist: %', msg, stmt;
end $$;

-- Profiler oprettes af triggeren på auth.users
select pg_temp.assert((select count(*) from public.profiles where id::text like '00000000-0000-4000-a000-%') = 5,
  'profiler oprettes automatisk');

-- Par A og B oprettes, og C prøver at komme med i et fuldt par
select pg_temp.login('a1');
select set_config('t.code_a', public.create_couple(), true);
select pg_temp.login('a2');
select public.join_couple(lower(current_setting('t.code_a')));  -- små bogstaver skal også virke
select pg_temp.login('b1');
select set_config('t.code_b', public.create_couple(), true);
select pg_temp.login('b2');
select public.join_couple(current_setting('t.code_b'));

select pg_temp.login('c');
select pg_temp.assert_denied($$select public.join_couple(current_setting('t.code_a'))$$,
  'en tredje person kan ikke komme med i et fuldt par');
select pg_temp.assert_denied($$select public.join_couple('XXXXXX')$$,
  'en ukendt invitationskode afvises');
select pg_temp.login('a1');
select pg_temp.assert_denied($$select public.create_couple()$$,
  'man kan ikke oprette et nyt par, når man allerede er i et');

-- Matchtrigger
select pg_temp.login('a1');
insert into public.swipes (user_id, title_id, action) values (auth.uid(), 'movie-900000001', 'like');
select pg_temp.assert((select count(*) from public.matches) = 0, 'intet match, før begge har liket');
select pg_temp.login('a2');
insert into public.swipes (user_id, title_id, action) values (auth.uid(), 'movie-900000001', 'superlike');
select pg_temp.assert((select count(*) from public.matches where title_id = 'movie-900000001') = 1,
  'match oprettes, når begge har liket (like + superlike)');
insert into public.swipes (user_id, title_id, action) values (auth.uid(), 'movie-900000002', 'like');

select pg_temp.login('b1');
insert into public.swipes (user_id, title_id, action) values (auth.uid(), 'movie-900000001', 'like');
select pg_temp.login('b2');
insert into public.swipes (user_id, title_id, action) values (auth.uid(), 'movie-900000001', 'nope');
select pg_temp.assert((select count(*) from public.matches) = 0, 'intet match for par B, når den ene siger nej');
update public.swipes set action = 'like' where user_id = auth.uid() and title_id = 'movie-900000001';
select pg_temp.assert((select count(*) from public.matches) = 1, 'match oprettes, når et nej ændres til like');

-- Par B kan ikke se par A's data
select pg_temp.login('b1');
select pg_temp.assert((select count(*) from public.couples) = 1, 'B ser kun sit eget par');
select pg_temp.assert((select count(*) from public.couple_members) = 2, 'B ser kun medlemmerne af sit eget par');
select pg_temp.assert(
  (select count(*) from public.profiles where id in (current_setting('t.a1')::uuid, current_setting('t.a2')::uuid)) = 0,
  'B kan ikke læse A''s profiler');
select pg_temp.assert(
  (select count(*) from public.swipes where user_id in (current_setting('t.a1')::uuid, current_setting('t.a2')::uuid)) = 0,
  'B kan ikke læse A''s swipes');
select pg_temp.assert((select count(*) from public.matches) = 1, 'B ser kun sit eget match');
select pg_temp.assert((select count(*) from public.profiles) = 2, 'B ser sin egen og partnerens profil');

-- Par B kan ikke ændre par A's data
select pg_temp.assert_denied(
  $$insert into public.swipes (user_id, title_id, action) values (current_setting('t.a1')::uuid, 'movie-900000002', 'like')$$,
  'B kan ikke swipe på vegne af A');
update public.swipes set action = 'nope' where user_id = current_setting('t.a1')::uuid;
delete from public.swipes where user_id = current_setting('t.a2')::uuid;
update public.profiles set display_name = 'hacket' where id = current_setting('t.a1')::uuid;
select pg_temp.logout();
select pg_temp.assert(
  (select count(*) from public.swipes where user_id in (current_setting('t.a1')::uuid, current_setting('t.a2')::uuid)) = 3,
  'B''s forsøg på at ændre og slette A''s swipes ramte ingen rækker');
select pg_temp.assert(
  (select display_name from public.profiles where id = current_setting('t.a1')::uuid) <> 'hacket',
  'B kunne ikke ændre A''s profil');
select set_config('t.match_a', (select m.id::text from public.matches m
  join public.couple_members cm on cm.couple_id = m.couple_id where cm.user_id = current_setting('t.a1')::uuid), true);

select pg_temp.login('b1');
update public.matches set status = 'seen' where id = current_setting('t.match_a')::uuid;
select pg_temp.assert_denied($$select public.rate_match(current_setting('t.match_a')::uuid, 5::smallint)$$,
  'B kan ikke vurdere A''s match');
select pg_temp.assert_denied(
  $$insert into public.matches (couple_id, title_id) values (public.my_couple_id(), 'movie-900000002')$$,
  'matches kan ikke oprettes direkte, kun af triggeren');
select pg_temp.assert_denied(
  $$insert into public.titles (id, tmdb_id, media_type, metadata) values ('movie-1', 1, 'movie', '{}')$$,
  'brugere kan ikke skrive i titelcachen');
select pg_temp.assert_denied(
  $$insert into public.couple_members (couple_id, user_id) select couple_id, current_setting('t.c')::uuid from public.couple_members limit 1$$,
  'medlemmer kan ikke tilføjes direkte uden om join_couple');
select pg_temp.assert_denied(
  $$insert into public.snoozed (user_id, title_id, until) values (current_setting('t.a1')::uuid, 'movie-900000002', now())$$,
  'B kan ikke sætte "ikke nu" for A');

select pg_temp.logout();
select pg_temp.assert((select status from public.matches where id = current_setting('t.match_a')::uuid) = 'unseen',
  'B kunne ikke ændre status på A''s match');

-- Vurderinger: hver kan kun sætte sin egen
select pg_temp.login('a2');
select pg_temp.assert_denied(
  $$update public.matches set ratings = '{"x": 1}' where id = current_setting('t.match_a')::uuid$$,
  'vurderinger kan ikke rettes direkte (kun med rate_match)');
select public.rate_match(current_setting('t.match_a')::uuid, 4::smallint);
select pg_temp.assert(
  (select ratings = jsonb_build_object(current_setting('t.a2'), 4) and status = 'seen'
   from public.matches where id = current_setting('t.match_a')::uuid),
  'A2 kan vurdere sit eget match, og det markeres som set');
update public.matches set status = 'unseen' where id = current_setting('t.match_a')::uuid;
select pg_temp.assert((select status from public.matches where id = current_setting('t.match_a')::uuid) = 'unseen',
  'A2 kan ændre status på sit eget match');

-- Inden for parret kan man se partnerens data
select pg_temp.login('a1');
select pg_temp.assert((select count(*) from public.swipes) = 3, 'A1 ser egne og partnerens swipes');
select pg_temp.assert((select count(*) from public.profiles) = 2, 'A1 ser egen og partnerens profil');

-- Den enlige bruger C ser ingenting fra parrene
select pg_temp.login('c');
select pg_temp.assert(
  (select count(*) from public.couples) + (select count(*) from public.matches) + (select count(*) from public.swipes) = 0,
  'C ser ingen par, matches eller swipes');

-- Uden login (anon) er der ingen adgang
select pg_temp.logout();
select set_config('role', 'anon', true);
select pg_temp.assert_denied($$select count(*) from public.swipes$$, 'anon kan ikke læse swipes');
select pg_temp.assert_denied($$select count(*) from public.profiles$$, 'anon kan ikke læse profiler');
select pg_temp.assert_denied($$select public.create_couple()$$, 'anon kan ikke oprette par');

select pg_temp.logout();
do $$ begin raise notice 'RLS-test bestået'; end $$;

rollback;
