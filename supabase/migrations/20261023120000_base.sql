-- Consultório: tabelas base e regras de acesso.
-- Cada usuária (coluna "dono") só enxerga e altera o que é dela; visitantes sem
-- login (anon) não têm acesso a nada. Pode ser colada no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- Configurações do consultório (uma linha por usuária)
-- ---------------------------------------------------------------------------
create table configuracoes (
  dono uuid not null default auth.uid() primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  nome_completo text,
  nome_exibicao text,
  titulo text,
  crp text,
  cpf text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  instagram text,
  duracao_padrao_min int not null default 50,
  sessoes_avaliacao_padrao int not null default 10,
  mensagem_whatsapp text not null,
  semanas_geradas int not null default 4,
  bloqueio_minutos int not null default 15
);

-- ---------------------------------------------------------------------------
-- Parceiros (profissionais que encaminham pacientes)
-- ---------------------------------------------------------------------------
create table parceiros (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  nome text not null,
  profissao text,
  contato text,
  observacoes text
);

-- ---------------------------------------------------------------------------
-- Pacientes e quem responde por eles
-- ---------------------------------------------------------------------------
create table pacientes (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  nome text not null,
  data_nascimento date,
  cpf text,
  escola text,
  serie text,
  observacoes text,
  status text not null default 'ativo' check (status in ('lista_espera', 'ativo', 'alta')),
  tipo text not null check (tipo in ('avaliacao', 'psicoterapia')),
  data_entrada date,
  data_alta date,
  parceiro_id uuid references parceiros (id) on delete set null,
  forma_cobranca text not null default 'por_sessao' check (forma_cobranca in ('por_sessao', 'mensal')),
  valor_sessao_centavos int not null default 0 check (valor_sessao_centavos >= 0)
);

create table responsaveis (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  nome text not null,
  parentesco text,
  cpf text,
  telefone text,
  email text,
  principal boolean not null default false,
  pagador boolean not null default false
);

-- No máximo um responsável principal por paciente.
create unique index responsaveis_um_principal_por_paciente
  on responsaveis (paciente_id) where principal;

-- ---------------------------------------------------------------------------
-- Agenda: horários fixos, avaliações, sessões e bloqueios
-- ---------------------------------------------------------------------------
create table horarios_fixos (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora time not null,
  duracao_min int not null check (duracao_min > 0),
  valido_de date not null,
  valido_ate date
);

create table avaliacoes (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  inicio date not null,
  fim date,
  sessoes_previstas int not null check (sessoes_previstas > 0),
  etapas jsonb not null default '[]'
);

create table sessoes (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  inicio timestamptz not null,
  duracao_min int not null,
  tipo text not null check (tipo in ('avaliacao', 'psicoterapia')),
  acompanhamento_familiar boolean not null default false,
  origem text not null check (origem in ('fixa', 'avulsa', 'remarcacao')),
  horario_fixo_id uuid references horarios_fixos (id) on delete set null,
  data_ocorrencia date,
  situacao text not null default 'agendada'
    check (situacao in ('agendada', 'compareceu', 'falta_com_aviso', 'falta_sem_aviso', 'cancelada', 'remarcada')),
  remarcada_para uuid references sessoes (id) on delete set null,
  avaliacao_id uuid references avaliacoes (id) on delete set null,
  confirmada boolean not null default false,
  observacao text,
  -- Uma ocorrência de horário fixo vira, no máximo, uma sessão. Sessões avulsas
  -- (horario_fixo_id ou data_ocorrencia nulos) não entram na regra: NULL não conflita.
  -- O app grava com upsert "on conflict (horario_fixo_id, data_ocorrencia) do nothing",
  -- por isso a restrição não pode ser parcial.
  unique (horario_fixo_id, data_ocorrencia)
);

create index sessoes_dono_inicio on sessoes (dono, inicio);

create table bloqueios (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  inicio date not null,
  fim date not null check (fim >= inicio),
  motivo text not null
);

-- ---------------------------------------------------------------------------
-- Acesso: cada usuária só mexe nas próprias linhas; anon fica de fora
-- ---------------------------------------------------------------------------
alter table configuracoes enable row level security;
create policy dono_tudo on configuracoes for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table parceiros enable row level security;
create policy dono_tudo on parceiros for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table pacientes enable row level security;
create policy dono_tudo on pacientes for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table responsaveis enable row level security;
create policy dono_tudo on responsaveis for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table horarios_fixos enable row level security;
create policy dono_tudo on horarios_fixos for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table avaliacoes enable row level security;
create policy dono_tudo on avaliacoes for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table sessoes enable row level security;
create policy dono_tudo on sessoes for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

alter table bloqueios enable row level security;
create policy dono_tudo on bloqueios for all to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
