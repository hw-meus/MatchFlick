-- Minimal attrap af det, Supabase selv stiller til rådighed (auth-skema, roller og
-- Realtime-publikation), så migrationer og RLS-test kan køres mod en almindelig lokal
-- PostgreSQL uden Docker. Bruges kun af scripts/test-rls-local.sh, aldrig i Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  aud text,
  role text
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;

create publication supabase_realtime;
