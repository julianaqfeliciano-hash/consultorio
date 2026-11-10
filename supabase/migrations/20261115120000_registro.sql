-- Consultório: registro da sessão (os quatro campos e o texto ditado).
-- Roda depois da cobrança. Mesmas regras de acesso: cada usuária (coluna "dono")
-- só enxerga e altera o que é dela; visitantes sem login (anon) não têm acesso
-- a nada. Pode ser colada no SQL Editor do Supabase.

-- Mesma linha da migração da cobrança: repetir não faz mal, e garante que a
-- tabela nova nasce sem acesso para anon mesmo se esta migração rodar isolada.
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Um registro por sessão (1:1): a chave primária é a própria sessão
-- ---------------------------------------------------------------------------
create table registros_sessao (
  sessao_id uuid primary key references sessoes (id) on delete cascade,
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto_falado text not null default '',
  como_chegou text not null default '',
  trabalhado text not null default '',
  observacoes text not null default '',
  proximos_passos text not null default '',
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Acesso: cada usuária só mexe nas próprias linhas; anon fica de fora
-- ---------------------------------------------------------------------------
alter table registros_sessao enable row level security;
create policy dono_tudo on registros_sessao for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

grant select, insert, update, delete on registros_sessao to authenticated;
revoke all on registros_sessao from anon;
