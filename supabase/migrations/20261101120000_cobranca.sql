-- Consultório: cobrança (valores, pagamentos e registro atômico de pagamento).
-- Roda depois da migração base. Mesmas regras de acesso: cada usuária (coluna
-- "dono") só enxerga e altera o que é dela; visitantes sem login (anon) não têm
-- acesso a nada. Pode ser colada no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- Tabelas criadas daqui para a frente não dão acesso a anon
-- ---------------------------------------------------------------------------
-- O Supabase concede tudo a anon em toda tabela nova do schema public. A
-- migração base só tirou o acesso das tabelas que existiam naquela hora; esta
-- linha fecha a porta também para as próximas.
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Valores nas tabelas que já existem
-- ---------------------------------------------------------------------------
-- Valor padrão do pacote de avaliação, usado ao criar uma avaliação nova.
alter table configuracoes
  add column valor_avaliacao_padrao_centavos int not null default 0
    check (valor_avaliacao_padrao_centavos >= 0);

-- Valor da sessão no dia em que ela aconteceu (reajuste não muda o passado).
-- Nulo = ainda não foi fixado.
alter table sessoes
  add column valor_centavos int check (valor_centavos is null or valor_centavos >= 0);

-- As sessões já marcadas antes desta migração (agenda das Etapas 1 e 2) ganham
-- o valor agora, com a mesma regra do app (valorCobradoDaSessao): psicoterapia
-- (inclusive o acompanhamento familiar) quando compareceu ou faltou sem aviso;
-- avaliação só quando faltou sem aviso (o comparecimento é do pacote). O valor
-- é o valor da sessão de hoje do paciente. As outras sessões continuam sem valor.
update sessoes s
set valor_centavos = p.valor_sessao_centavos
from pacientes p
where p.id = s.paciente_id
  and s.valor_centavos is null
  and (
    (s.tipo = 'psicoterapia' and s.situacao in ('compareceu', 'falta_sem_aviso'))
    or (s.tipo = 'avaliacao' and s.situacao = 'falta_sem_aviso')
  );

-- Pacote da avaliação: valor previsto e desconto (em reais ou em porcentagem).
-- Quando o tipo é 'reais', desconto_valor está em centavos; quando é
-- 'percentual', é a porcentagem, de 0 a 100.
alter table avaliacoes
  add column valor_previsto_centavos int not null default 0 check (valor_previsto_centavos >= 0),
  add column desconto_tipo text not null default 'nenhum'
    check (desconto_tipo in ('nenhum', 'reais', 'percentual')),
  add column desconto_valor int not null default 0 check (desconto_valor >= 0),
  add constraint avaliacoes_desconto_percentual_ate_100
    check (desconto_tipo <> 'percentual' or desconto_valor <= 100);

-- ---------------------------------------------------------------------------
-- Pagamentos
-- ---------------------------------------------------------------------------
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  data date not null,
  valor_centavos int not null check (valor_centavos > 0),
  forma text not null check (forma in ('pix', 'dinheiro', 'cartao', 'transferencia')),
  observacao text,
  -- O que está sendo pago: sessões soltas, um mês inteiro ou o pacote da avaliação.
  referencia text not null check (referencia in ('sessoes', 'mes', 'avaliacao')),
  -- Só no pagamento do mês, sempre o dia 1. Um mês pode ter mais de um pagamento
  -- (o da diferença, quando o total sobe depois do pagamento), como as parcelas
  -- da avaliação: quem confere se ainda falta algo é o app.
  mes_referencia date check (mes_referencia is null or extract(day from mes_referencia) = 1),
  -- Só no pagamento da avaliação. Avaliação com pagamento não pode ser apagada.
  avaliacao_id uuid references avaliacoes (id) on delete restrict,
  constraint pagamentos_mes_coerente
    check ((referencia = 'mes') = (mes_referencia is not null)),
  constraint pagamentos_avaliacao_coerente
    check ((referencia = 'avaliacao') = (avaliacao_id is not null))
);

-- Quais sessões cada pagamento quitou. Uma sessão só pode ser paga uma vez
-- (unique em sessao_id) e uma sessão paga não pode ser apagada.
create table pagamento_sessoes (
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pagamento_id uuid not null references pagamentos (id) on delete cascade,
  sessao_id uuid not null references sessoes (id) on delete restrict,
  primary key (pagamento_id, sessao_id),
  unique (sessao_id)
);

-- ---------------------------------------------------------------------------
-- Registrar um pagamento de uma vez só
-- ---------------------------------------------------------------------------
-- Grava o pagamento e as ligações com as sessões na mesma chamada, portanto na
-- mesma transação: se uma sessão já estiver paga (unique), nada é gravado.
-- "security invoker": roda com os direitos de quem chama, então o RLS vale e o
-- dono das linhas é a usuária logada (auth.uid() é o padrão da coluna).
create function registrar_pagamento(
  p_paciente_id uuid,
  p_data date,
  p_valor_centavos int,
  p_forma text,
  p_observacao text,
  p_referencia text,
  p_mes_referencia date,
  p_avaliacao_id uuid,
  p_sessao_ids uuid[]
) returns pagamentos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pagamento pagamentos;
begin
  insert into pagamentos (
    paciente_id, data, valor_centavos, forma, observacao,
    referencia, mes_referencia, avaliacao_id
  ) values (
    p_paciente_id, p_data, p_valor_centavos, p_forma, p_observacao,
    p_referencia, p_mes_referencia, p_avaliacao_id
  ) returning * into v_pagamento;

  insert into pagamento_sessoes (pagamento_id, sessao_id)
  select v_pagamento.id, sessao_id
  from unnest(coalesce(p_sessao_ids, '{}'::uuid[])) as sessao_id;

  return v_pagamento;
end;
$$;

-- Funções nascem executáveis por todo mundo; aqui só authenticated executa.
revoke all on function registrar_pagamento(uuid, date, int, text, text, text, date, uuid, uuid[])
  from public, anon;
grant execute on function registrar_pagamento(uuid, date, int, text, text, text, date, uuid, uuid[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- Acesso: cada usuária só mexe nas próprias linhas; anon fica de fora
-- ---------------------------------------------------------------------------
alter table pagamentos enable row level security;
create policy dono_tudo on pagamentos for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table pagamento_sessoes enable row level security;
create policy dono_tudo on pagamento_sessoes for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

grant select, insert, update, delete on pagamentos, pagamento_sessoes to authenticated;
revoke all on pagamentos, pagamento_sessoes from anon;
