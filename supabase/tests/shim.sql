-- Imita, no PGlite, o mínimo do Supabase de que a migração depende.
-- Só existe para os testes: NUNCA vai para um projeto Supabase de verdade.

create schema auth;
create table auth.users (id uuid primary key);

-- Igual ao Supabase: lê o id da usuária do "JWT" da sessão (vazio = ninguém).
create function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role anon nologin;
create role authenticated nologin;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- O Supabase concede tudo a anon e authenticated em toda tabela nova do
-- schema public. Reproduzimos isso para o teste provar que a migração
-- realmente tira o acesso de anon.
alter default privileges in schema public grant all on tables to anon, authenticated;
