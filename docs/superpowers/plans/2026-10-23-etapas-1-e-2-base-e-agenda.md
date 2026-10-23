# Etapas 1 e 2 — Base e Agenda: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira versão utilizável do sistema do consultório: login, configurações, parceiros, pacientes com ficha completa, horários fixos, agenda da semana com presença, remarcação, bloqueio de dias e lista de amanhã com WhatsApp — com a identidade visual do kit.

**Architecture:** Aplicativo React (PWA) que fala com o Supabase por uma interface única `Repositorio`. Há duas implementações: `supabase` (produção) e `memoria` (modo demonstração e testes). As regras de negócio ficam em funções puras em `src/regras/`; a orquestração (gerar agenda, remarcar, bloquear, dar alta) fica em `src/servicos/` e é testada contra o repositório em memória. O banco é definido por migrações SQL com Row Level Security, testadas no PGlite (Postgres em WebAssembly).

**Tech Stack:** Node 22, Vite, React 19, TypeScript (strict), Tailwind CSS 4 (`@tailwindcss/vite`), React Router 7, TanStack Query 5, `@supabase/supabase-js` 2, `vite-plugin-pwa`, `date-fns` 4 + `@date-fns/tz`, `lucide-react`, `@fontsource/prata`, `@fontsource/nunito-sans`; testes com Vitest + Testing Library (jsdom) + `@electric-sql/pglite`; E2E com `@playwright/test@1.56.1` (casa com o Chromium pré-instalado).

**Spec:** `docs/superpowers/specs/2026-10-21-sistema-consultorio-design.md` (§4.1, §4.2, §4.5, §4.6, §5, §10 login/acesso, §12). Leia o spec antes de começar.

**Fora deste plano (planos seguintes):** cobrança e pagamentos (Etapa 3), registro com o Claude (4), documentos (5), despesas/recibos/relatórios (6), backup, duas etapas e bloqueio automático (7). As abas **Financeiro** e **Relatórios** existem, mas mostram “Em construção”.

## Global Constraints

- Todo texto de interface em português do Brasil, tratando a usuária por “você”.
- Fuso horário único: `America/Sao_Paulo`. Datas e horas são **sempre** calculadas nesse fuso, nunca no fuso do aparelho.
- Datas de calendário trafegam como `DataISO` (`'YYYY-MM-DD'`); instantes como string ISO UTC (`'2026-11-03T17:00:00.000Z'`); horas como `'HH:MM'`.
- Valores em dinheiro: inteiros em **centavos**.
- Paleta (Tailwind `@theme`): `creme #F6F3EA`, `petroleo #1D5C68`, `verde #6E9A80`, `verde-folha #7FB08C`, `amarelo #F2B65A`, `laranja #EE8B4E`, `azul-claro #8EC3DE`, `azul-petroleo #3A9E9A`, `azul-marinho #33507A`, `verde-claro #BFD9C5`.
- Fontes: `Prata` (títulos e nome), `Nunito Sans` (textos). Auto-hospedadas via `@fontsource`.
- Cores por tipo: Avaliação = `amarelo`, Psicoterapia = `laranja`, Acompanhamento familiar = `azul-claro`.
- Rótulos exatos — situações: `Agendada`, `Compareceu`, `Faltou com aviso`, `Faltou sem aviso`, `Cancelada`, `Remarcada`; tipos: `Avaliação`, `Psicoterapia`, `Acompanhamento familiar`. Situações aparecem **sempre com texto e ícone**, nunca só cor.
- Áreas de toque com no mínimo 44 × 44 px.
- Nenhum dado de paciente em `localStorage`/`sessionStorage`.
- Todas as tabelas: `dono uuid not null default auth.uid()` + RLS `dono = auth.uid()` para tudo; `anon` sem acesso.
- Comandos que precisam passar antes de cada commit: `npm run typecheck`, `npm run lint`, `npm test`.

## Review Focus

1. **Aparelho em outro fuso / sessões perto da meia-noite** — uma sessão às 23:30 de terça em São Paulo é “terça” em qualquer aparelho. Teste: `dataLocal('2026-11-04T02:30:00.000Z') === '2026-11-03'` (Task 3).
2. **Agenda aberta em dois aparelhos ao mesmo tempo** — gerar a agenda duas vezes não duplica sessões. Teste no banco (Task 2) e no contrato do repositório (Task 4): inserir a mesma ocorrência duas vezes resulta em uma linha.
3. **Paciente sem responsável principal ou sem telefone na lista de amanhã** — o item aparece, sem botão de WhatsApp, com o texto “sem telefone”. Teste na Task 10.
4. **Paciente muda de avaliação para psicoterapia** — as sessões futuras ainda agendadas passam a ser de psicoterapia; o histórico não muda. Teste na Task 5.
5. **Bloqueio sobre um período com sessões já marcadas** — só sessões `agendada` são canceladas; `compareceu`/faltas ficam como estão. Teste na Task 5.

---

## Estrutura de arquivos

```
consultorio/
  index.html                          # lang pt-BR, apple-touch-icon, theme-color
  vite.config.ts                      # react, tailwind, pwa
  vitest.config.ts                    # projetos "unidade" (node) e "interface" (jsdom)
  playwright.config.ts
  public/marca/…                      # já existe (logo e ícones)
  supabase/
    migrations/20261023120000_base.sql
    tests/shim.sql                    # imita auth.uid(), papéis anon/authenticated
    tests/banco.ts                    # cria PGlite + aplica shim e migrações
    tests/rls.test.ts
  src/
    main.tsx, App.tsx                 # rotas e provedores
    config.ts                         # modo 'supabase' | 'demonstracao'
    estilo/global.css                 # tailwind + @theme
    dominio/tipos.ts                  # tipos do domínio
    dominio/padroes.ts                # dados profissionais, mensagem, etapas padrão
    dominio/rotulos.ts                # rótulos e ícones de situações e tipos
    regras/datas.ts, regras/agenda.ts, regras/whatsapp.ts, regras/dinheiro.ts
    dados/repositorio.ts              # interface Repositorio
    dados/memoria.ts                  # implementação em memória
    dados/mapeamento.ts               # linhas snake_case <-> objetos camelCase
    dados/supabase.ts                 # implementação Supabase
    dados/repositorio.contrato.ts     # suíte de contrato reutilizável
    dados/semente-demo.ts             # dados fictícios do modo demonstração
    dados/contexto.tsx                # RepositorioProvider, useRepositorio
    dados/autenticacao.ts             # interface + implementações supabase/demo
    servicos/agenda.ts, servicos/pacientes.ts
    componentes/                      # Logo, Layout, BarraNavegacao, Botao, Campo, ChipSituacao, Folha (painel inferior), EmConstrucao
    telas/login/, telas/agenda/, telas/pacientes/, telas/financeiro/, telas/relatorios/, telas/mais/
  e2e/fluxo-principal.spec.ts
  docs/instalacao.md
```

---

### Task 1: Projeto base, identidade visual e PWA

**Files:**
- Create: `package.json`, `tsconfig*.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `src/main.tsx`, `src/App.tsx`, `src/estilo/global.css`, `src/componentes/Logo.tsx`, `src/componentes/Layout.tsx`, `src/componentes/BarraNavegacao.tsx`, `src/componentes/EmConstrucao.tsx`, `src/telas/*/Tela*.tsx` (placeholders), `.gitignore`
- Test: `src/componentes/Layout.test.tsx`

**Interfaces:**
- Produces: `<Logo variante="completa" | "simbolo" />`; `<Layout />` (rota-mãe com `<Outlet/>`); rotas `/agenda` (padrão de `/`), `/pacientes`, `/financeiro`, `/relatorios`, `/mais`; scripts `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `e2e`.

- [ ] **Step 1: Criar o projeto** — Vite `react-ts` na raiz do repositório (sem apagar `docs/` e `public/marca/`); instalar as dependências do Tech Stack. TypeScript `strict: true`. `.gitignore` com `node_modules`, `dist`, `.env*` (exceto `.env.example`), `test-results`, `playwright-report`.

- [ ] **Step 2: Escrever o teste que falha**

```tsx
// src/componentes/Layout.test.tsx
it('mostra as 5 abas na ordem do spec', () => {
  renderComRotas('/agenda');
  const abas = screen.getAllByRole('link', { name: /agenda|pacientes|financeiro|relatórios|mais/i });
  expect(abas.map((a) => a.textContent)).toEqual(['Agenda', 'Pacientes', 'Financeiro', 'Relatórios', 'Mais']);
});
it('marca a aba atual com aria-current', () => {
  renderComRotas('/pacientes');
  expect(screen.getByRole('link', { name: 'Pacientes' })).toHaveAttribute('aria-current', 'page');
});
it('mostra a logo com o nome', () => {
  renderComRotas('/agenda');
  expect(screen.getByText('Juliana Feliciano')).toBeInTheDocument();
});
it('Financeiro mostra "Em construção"', () => {
  renderComRotas('/financeiro');
  expect(screen.getByText(/em construção/i)).toBeInTheDocument();
});
```
`renderComRotas(caminho)` é um helper em `src/testes/utilitarios.tsx` que monta `MemoryRouter` com as rotas do `App`.

- [ ] **Step 3: Rodar e ver falhar** — `npm test -- src/componentes/Layout.test.tsx` → FAIL (componentes não existem).

- [ ] **Step 4: Implementar**
  - `global.css`: `@import "tailwindcss";` + `@theme` com as cores e fontes das Global Constraints (`--font-titulo: "Prata", serif; --font-texto: "Nunito Sans", sans-serif;`); `body` com fundo `creme`, texto `petroleo`, fonte `texto`.
  - `Logo`: `completa` = `/marca/logo.svg` (altura 40 px) + “Juliana Feliciano” em Prata + “PSICÓLOGA INFANTIL” em Nunito Sans maiúsculas com `tracking-[0.25em]`; `simbolo` = só a imagem. `alt=""` na imagem (o nome já está em texto).
  - `Layout`: no celular (< 768 px), barra inferior fixa com as 5 abas (ícones `lucide-react`: `CalendarDays`, `Users`, `Wallet`, `BarChart3`, `Menu`); a partir de 768 px, barra lateral com a logo completa no topo. Cabeçalho do celular com a logo `simbolo` + nome.
  - `vite-plugin-pwa`: `registerType: 'autoUpdate'`; manifesto `name: 'Consultório · Juliana Feliciano'`, `short_name: 'Consultório'`, `lang: 'pt-BR'`, `theme_color: '#1D5C68'`, `background_color: '#F6F3EA'`, `display: 'standalone'`, ícones `/marca/icone-192.png` (192), `/marca/icone-512.png` (512, `purpose: 'any maskable'`). `index.html`: `<html lang="pt-BR">`, `<link rel="apple-touch-icon" href="/marca/icone-180.png">`, `<meta name="theme-color" content="#1D5C68">`, título “Consultório · Juliana Feliciano”.
  - `vitest.config.ts` com dois projetos: `unidade` (environment `node`, `src/regras/**`, `src/servicos/**`, `src/dados/**/*.test.ts`, `supabase/tests/**`) e `interface` (environment `jsdom`, `src/**/*.test.tsx`, setup com `@testing-library/jest-dom/vitest`).

- [ ] **Step 5: Rodar e ver passar** — `npm test` → PASS; `npm run typecheck`, `npm run lint`, `npm run build` sem erros; `dist/manifest.webmanifest` existe.

- [ ] **Step 6: Commit** — `git commit -m "Cria projeto base com identidade visual e PWA"`

---

### Task 2: Banco de dados — migração base e regras de acesso

**Files:**
- Create: `supabase/migrations/20261023120000_base.sql`, `supabase/tests/shim.sql`, `supabase/tests/banco.ts`
- Test: `supabase/tests/rls.test.ts`

**Interfaces:**
- Produces (tabelas, todas com `id uuid primary key default gen_random_uuid()` — exceto `configuracoes` —, `dono uuid not null default auth.uid() references auth.users(id) on delete cascade`, `criado_em timestamptz not null default now()`):
  - `configuracoes` (PK `dono`): `nome_completo`, `nome_exibicao`, `titulo`, `crp`, `cpf`, `telefone`, `email`, `endereco`, `cidade`, `instagram` (text), `duracao_padrao_min int not null default 50`, `sessoes_avaliacao_padrao int not null default 10`, `mensagem_whatsapp text not null`, `semanas_geradas int not null default 4`, `bloqueio_minutos int not null default 15`.
  - `parceiros`: `nome text not null`, `profissao`, `contato`, `observacoes`.
  - `pacientes`: `nome text not null`, `data_nascimento date`, `cpf`, `escola`, `serie`, `observacoes`, `status text not null check (status in ('lista_espera','ativo','alta')) default 'ativo'`, `tipo text not null check (tipo in ('avaliacao','psicoterapia'))`, `data_entrada date`, `data_alta date`, `parceiro_id uuid references parceiros on delete set null`, `forma_cobranca text not null check (forma_cobranca in ('por_sessao','mensal')) default 'por_sessao'`, `valor_sessao_centavos int not null default 0 check (valor_sessao_centavos >= 0)`.
  - `responsaveis`: `paciente_id uuid not null references pacientes on delete cascade`, `nome text not null`, `parentesco`, `cpf`, `telefone`, `email`, `principal bool not null default false`, `pagador bool not null default false`. Índice único parcial: um `principal = true` por paciente.
  - `horarios_fixos`: `paciente_id` (cascade), `dia_semana int not null check (dia_semana between 0 and 6)` (0 = domingo), `hora time not null`, `duracao_min int not null check (duracao_min > 0)`, `valido_de date not null`, `valido_ate date`.
  - `avaliacoes`: `paciente_id` (cascade), `inicio date not null`, `fim date`, `sessoes_previstas int not null check (sessoes_previstas > 0)`, `etapas jsonb not null default '[]'`.
  - `sessoes`: `paciente_id` (cascade), `inicio timestamptz not null`, `duracao_min int not null`, `tipo` (mesmo check de pacientes), `acompanhamento_familiar bool not null default false`, `origem text not null check (origem in ('fixa','avulsa','remarcacao'))`, `horario_fixo_id uuid references horarios_fixos on delete set null`, `data_ocorrencia date`, `situacao text not null default 'agendada' check (situacao in ('agendada','compareceu','falta_com_aviso','falta_sem_aviso','cancelada','remarcada'))`, `remarcada_para uuid references sessoes on delete set null`, `avaliacao_id uuid references avaliacoes on delete set null`, `confirmada bool not null default false`, `observacao text`. **`unique (horario_fixo_id, data_ocorrencia)`** (NULLs não conflitam). Índice `(dono, inicio)`.
  - `bloqueios`: `inicio date not null`, `fim date not null check (fim >= inicio)`, `motivo text not null`.
  - Em todas: `alter table … enable row level security;` + `create policy dono_tudo on … for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());`. Ao final: `grant select, insert, update, delete on all tables in schema public to authenticated; revoke all on all tables in schema public from anon;`.
- Produces (teste): `criarBanco(): Promise<PGlite>`, `comoUsuario(db: PGlite, id: string): Promise<void>` (faz `set role authenticated` + `set_config('request.jwt.claim.sub', id, false)`), `comoAnonimo(db)`, `criarUsuario(db): Promise<string>` (insere em `auth.users` como superusuário e devolve o id).
- `shim.sql`: `create schema auth; create table auth.users (id uuid primary key);` função `auth.uid()` = `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`; papéis `anon` e `authenticated` (`nologin`); `grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// supabase/tests/rls.test.ts
it('usuária vê só os próprios pacientes', async () => {
  const db = await criarBanco(); const a = await criarUsuario(db); const b = await criarUsuario(db);
  await comoUsuario(db, a);
  await db.query(`insert into pacientes (nome, tipo) values ('Ana', 'psicoterapia')`);
  await comoUsuario(db, b);
  expect((await db.query('select * from pacientes')).rows).toHaveLength(0);
  await comoUsuario(db, a);
  expect((await db.query('select * from pacientes')).rows).toHaveLength(1);
});
it('anônimo não lê nem grava nada', async () => {
  const db = await criarBanco(); await comoAnonimo(db);
  await expect(db.query('select * from pacientes')).rejects.toThrow(/permission denied/);
});
it('não deixa gravar com dono de outra pessoa', async () => {
  const db = await criarBanco(); const a = await criarUsuario(db); const b = await criarUsuario(db);
  await comoUsuario(db, a);
  await expect(db.query(`insert into parceiros (nome, dono) values ('X', '${b}')`)).rejects.toThrow(/row-level security/);
});
it('mesma ocorrência de horário fixo não duplica', async () => {
  // cria paciente + horário; insere duas vezes (horario_fixo_id, data_ocorrencia) = (h, '2026-11-03')
  // com "on conflict (horario_fixo_id, data_ocorrencia) do nothing"
  expect((await db.query('select count(*)::int as n from sessoes')).rows[0].n).toBe(1);
});
it('só um responsável principal por paciente', async () => { /* segundo principal=true → rejeita (unique) */ });
it('rejeita situação inválida', async () => { /* situacao = 'faltou' → rejeita (check) */ });
```
Uma checagem extra percorre `pg_tables` do schema `public` e exige `rowsecurity = true` em todas.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- supabase/tests` → FAIL (migração não existe).
- [ ] **Step 3: Escrever `shim.sql`, `banco.ts` e a migração** conforme Interfaces. `banco.ts` lê os arquivos de `supabase/migrations/` em ordem alfabética.
- [ ] **Step 4: Rodar e ver passar** — `npm test -- supabase/tests` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Adiciona migração base com RLS e testes no PGlite"`

---

### Task 3: Regras de datas e de agenda

**Files:**
- Create: `src/dominio/tipos.ts`, `src/regras/datas.ts`, `src/regras/agenda.ts`
- Test: `src/regras/datas.test.ts`, `src/regras/agenda.test.ts`

**Interfaces:**
- Produces (`src/dominio/tipos.ts`):
  ```ts
  export type Id = string; export type DataISO = string; export type Hora = string; // 'HH:MM'
  export type StatusPaciente = 'lista_espera' | 'ativo' | 'alta';
  export type TipoAtendimento = 'avaliacao' | 'psicoterapia';
  export type FormaCobranca = 'por_sessao' | 'mensal';
  export type SituacaoSessao = 'agendada' | 'compareceu' | 'falta_com_aviso' | 'falta_sem_aviso' | 'cancelada' | 'remarcada';
  export type OrigemSessao = 'fixa' | 'avulsa' | 'remarcacao';
  export interface Configuracoes { nomeCompleto: string; nomeExibicao: string; titulo: string; crp: string; cpf: string; telefone: string; email: string; endereco: string; cidade: string; instagram: string; duracaoPadraoMin: number; sessoesAvaliacaoPadrao: number; mensagemWhatsapp: string; semanasGeradas: number; bloqueioMinutos: number }
  export interface Parceiro { id: Id; nome: string; profissao: string; contato: string; observacoes: string }
  export interface Paciente { id: Id; nome: string; dataNascimento: DataISO | null; cpf: string | null; escola: string; serie: string; observacoes: string; status: StatusPaciente; tipo: TipoAtendimento; dataEntrada: DataISO | null; dataAlta: DataISO | null; parceiroId: Id | null; formaCobranca: FormaCobranca; valorSessaoCentavos: number }
  export interface Responsavel { id: Id; pacienteId: Id; nome: string; parentesco: string; cpf: string | null; telefone: string; email: string | null; principal: boolean; pagador: boolean }
  export interface HorarioFixo { id: Id; pacienteId: Id; diaSemana: number; hora: Hora; duracaoMin: number; validoDe: DataISO; validoAte: DataISO | null }
  export interface Etapa { nome: string; feita: boolean }
  export interface Avaliacao { id: Id; pacienteId: Id; inicio: DataISO; fim: DataISO | null; sessoesPrevistas: number; etapas: Etapa[] }
  export interface Sessao { id: Id; pacienteId: Id; inicio: string; duracaoMin: number; tipo: TipoAtendimento; acompanhamentoFamiliar: boolean; origem: OrigemSessao; horarioFixoId: Id | null; dataOcorrencia: DataISO | null; situacao: SituacaoSessao; remarcadaPara: Id | null; avaliacaoId: Id | null; confirmada: boolean; observacao: string | null }
  export interface Bloqueio { id: Id; inicio: DataISO; fim: DataISO; motivo: string }
  export type NovaSessao = Omit<Sessao, 'id'>;
  export interface HorarioComPaciente extends HorarioFixo { statusPaciente: StatusPaciente; tipoPaciente: TipoAtendimento; avaliacaoId: Id | null }
  ```
- Produces (`src/regras/datas.ts`): `FUSO = 'America/Sao_Paulo'`; `hojeISO(agora?: Date): DataISO`; `somarDias(d: DataISO, n: number): DataISO`; `diaDaSemana(d: DataISO): number` (0 = domingo); `instanteDe(d: DataISO, h: Hora): string`; `dataLocal(instante: string): DataISO`; `horaLocal(instante: string): Hora`; `inicioDaSemana(d: DataISO): DataISO` (segunda-feira); `diaPorExtenso(d: DataISO): string`; `entre(d: DataISO, ini: DataISO, fim: DataISO): boolean` (inclusivo).
- Produces (`src/regras/agenda.ts`): `chaveOcorrencia(horarioFixoId: Id, d: DataISO): string`; `gerarOcorrencias(e: { horarios: HorarioComPaciente[]; bloqueios: Bloqueio[]; existentes: Set<string>; de: DataISO; ate: DataISO }): NovaSessao[]`; `estaBloqueado(d: DataISO, bloqueios: Bloqueio[]): boolean`; `ehCobravel(s: SituacaoSessao): boolean`; `numeroNaAvaliacao(sessoes: Sessao[], alvo: Sessao): number`; `selecionarAgendadas(sessoes: Sessao[], f: { pacienteId?: Id; horarioFixoId?: Id; de: DataISO; ate?: DataISO; somenteFixas?: boolean }): Id[]`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// datas.test.ts
expect(instanteDe('2026-11-03', '14:00')).toBe('2026-11-03T17:00:00.000Z');
expect(dataLocal('2026-11-04T02:30:00.000Z')).toBe('2026-11-03');   // Review Focus 1
expect(horaLocal('2026-11-03T17:00:00.000Z')).toBe('14:00');
expect(diaDaSemana('2026-11-03')).toBe(2);                          // terça
expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02');            // domingo → segunda anterior
expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
expect(diaPorExtenso('2026-11-03')).toBe('terça-feira, 03/11');
expect(hojeISO(new Date('2026-11-04T02:30:00.000Z'))).toBe('2026-11-03');

// agenda.test.ts — base: horário terça 14:00, 50 min, válido desde 2026-10-01, paciente ativo em psicoterapia
it('gera uma sessão por semana no dia certo', () => {
  const r = gerarOcorrencias({ horarios: [h], bloqueios: [], existentes: new Set(), de: '2026-11-02', ate: '2026-11-29' });
  expect(r.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  expect(r[0]).toMatchObject({ inicio: '2026-11-03T17:00:00.000Z', duracaoMin: 50, tipo: 'psicoterapia', origem: 'fixa', horarioFixoId: h.id, situacao: 'agendada', confirmada: false, acompanhamentoFamiliar: false });
});
it('não repete ocorrências existentes', () => { /* existentes = {chaveOcorrencia(h.id,'2026-11-10')} → 3 sessões, sem 11-10 */ });
it('pula dias bloqueados (limites inclusivos)', () => { /* bloqueio 2026-11-10..2026-11-17 → só 11-03 e 11-24 */ });
it('respeita validoDe e validoAte', () => { /* validoAte '2026-11-12' → 11-03 e 11-10 */ });
it('ignora pacientes em lista de espera ou de alta', () => { /* statusPaciente 'alta' → [] */ });
it('liga sessões de avaliação à avaliação', () => { /* tipoPaciente 'avaliacao', avaliacaoId 'av1' → tipo 'avaliacao', avaliacaoId 'av1' */ });
it('cobrança por situação', () => {
  expect(['compareceu', 'falta_sem_aviso'].every((s) => ehCobravel(s as SituacaoSessao))).toBe(true);
  expect(['agendada', 'falta_com_aviso', 'cancelada', 'remarcada'].some((s) => ehCobravel(s as SituacaoSessao))).toBe(false);
});
it('numeroNaAvaliacao conta só realizadas antes', () => { /* 3 compareceu + 1 falta antes do alvo → 4 */ });
it('selecionarAgendadas filtra por paciente, horário, período e origem', () => { /* devolve só ids 'agendada' que casam */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- src/regras` → FAIL.
- [ ] **Step 3: Implementar** com `@date-fns/tz` (`TZDate`) para todas as conversões; `diaPorExtenso` com `date-fns/locale/pt-BR` (formato `EEEE, dd/MM`). `numeroNaAvaliacao` = quantidade de sessões com o mesmo `avaliacaoId`, situação `compareceu` e `inicio` anterior ao alvo, mais 1.
- [ ] **Step 4: Rodar e ver passar** — `npm test -- src/regras` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Adiciona regras de datas e geração da agenda"`

---

### Task 4: Camada de dados — repositório em memória e Supabase

**Files:**
- Create: `src/dados/repositorio.ts`, `src/dados/memoria.ts`, `src/dados/mapeamento.ts`, `src/dados/supabase.ts`, `src/dados/repositorio.contrato.ts`, `src/dados/semente-demo.ts`, `src/dados/contexto.tsx`, `src/config.ts`, `src/dominio/padroes.ts`, `.env.example`
- Test: `src/dados/memoria.test.ts`, `src/dados/mapeamento.test.ts`, `src/dados/supabase.contrato.test.ts`

**Interfaces:**
- Consumes: tipos da Task 3.
- Produces (`src/dados/repositorio.ts`):
  ```ts
  export type Rascunho<T extends { id: Id }> = Omit<T, 'id'> & { id?: Id };
  export interface FichaPaciente { paciente: Paciente; responsaveis: Responsavel[]; horarios: HorarioFixo[]; avaliacao: Avaliacao | null }
  export interface SessaoComPaciente extends Sessao { pacienteNome: string; responsavelPrincipal: { nome: string; telefone: string } | null }
  export interface Repositorio {
    obterConfiguracoes(): Promise<Configuracoes | null>;
    salvarConfiguracoes(c: Configuracoes): Promise<void>;
    listarParceiros(): Promise<Parceiro[]>;
    salvarParceiro(p: Rascunho<Parceiro>): Promise<Parceiro>;
    removerParceiro(id: Id): Promise<void>;
    listarPacientes(): Promise<Paciente[]>;
    obterFicha(pacienteId: Id): Promise<FichaPaciente | null>;
    salvarPaciente(p: Rascunho<Paciente>): Promise<Paciente>;
    salvarResponsavel(r: Rascunho<Responsavel>): Promise<Responsavel>;   // ao salvar principal=true, desmarca os outros do paciente
    removerResponsavel(id: Id): Promise<void>;
    salvarHorario(h: Rascunho<HorarioFixo>): Promise<HorarioFixo>;
    salvarAvaliacao(a: Rascunho<Avaliacao>): Promise<Avaliacao>;
    listarHorariosVigentes(de: DataISO, ate: DataISO): Promise<HorarioComPaciente[]>;
    listarSessoes(de: DataISO, ate: DataISO): Promise<SessaoComPaciente[]>;   // por data local, ordenadas por inicio
    listarSessoesDoPaciente(pacienteId: Id): Promise<Sessao[]>;
    inserirOcorrencias(novas: NovaSessao[]): Promise<number>;   // ignora conflito (horarioFixoId, dataOcorrencia); devolve quantas entraram
    criarSessao(nova: NovaSessao): Promise<Sessao>;
    atualizarSessao(id: Id, mudancas: Partial<Omit<Sessao, 'id' | 'pacienteId'>>): Promise<Sessao>;
    removerSessoes(ids: Id[]): Promise<void>;
    listarBloqueios(): Promise<Bloqueio[]>;
    salvarBloqueio(b: Rascunho<Bloqueio>): Promise<Bloqueio>;
    removerBloqueio(id: Id): Promise<void>;
  }
  ```
- Produces: `criarRepositorioMemoria(semente?: { pacientes?: …; responsaveis?: …; horarios?: …; avaliacoes?: …; parceiros?: …; configuracoes?: Configuracoes }): Repositorio`; `criarRepositorioSupabase(cliente: SupabaseClient): Repositorio`; `testarContrato(nome: string, fabrica: () => Promise<Repositorio>): void`; `sementeDemo(hoje: DataISO)`; `RepositorioProvider`, `useRepositorio(): Repositorio`; `config: { modo: 'supabase' | 'demonstracao'; supabaseUrl?: string; supabaseChave?: string }` lendo `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (modo `demonstracao` quando faltar qualquer uma).
- Produces (`src/dominio/padroes.ts`): `DADOS_PROFISSIONAIS` (Juliana Queiroz Feliciano · nome de exibição Juliana Feliciano · Psicóloga Infantil · CRP 11/16479 · (85) 98823-2033 · julianaqfeliciano@gmail.com · Av. Washington Soares, 855 – Sala 802 · Fortaleza – CE · @julianaqfelicianopsi); `CONFIGURACOES_PADRAO: Configuracoes` (= dados profissionais + `duracaoPadraoMin: 50`, `sessoesAvaliacaoPadrao: 10`, `semanasGeradas: 4`, `bloqueioMinutos: 15`, `mensagemWhatsapp` = texto exato do spec §5.5); `ETAPAS_AVALIACAO_PADRAO = ['Entrevista com os responsáveis', 'Testes aplicados', 'Contato com a escola', 'Devolutiva', 'Laudo entregue']`.

- [ ] **Step 1: Escrever os testes que falham**
  - `repositorio.contrato.ts` — suíte com, no mínimo: salvar e reler paciente (todos os campos); `obterFicha` traz responsáveis, horários e avaliação; marcar um segundo responsável como principal desmarca o primeiro; `inserirOcorrencias` com a mesma ocorrência duas vezes → `listarSessoes` devolve 1 e a segunda chamada devolve `0` (Review Focus 2); `listarSessoes('2026-11-03','2026-11-03')` inclui sessão de 23:30 local e exclui a de 00:30 do dia seguinte; `listarSessoes` traz `pacienteNome` e `responsavelPrincipal` (ou `null`); `atualizarSessao` devolve a sessão alterada; `removerSessoes` remove só os ids passados; `listarHorariosVigentes` exclui horários com `validoAte` antes de `de`.
  - `memoria.test.ts`: `testarContrato('memoria', async () => criarRepositorioMemoria())`.
  - `supabase.contrato.test.ts`: roda `testarContrato('supabase', …)` **somente** se `TEST_SUPABASE_URL`, `TEST_SUPABASE_KEY`, `TEST_SUPABASE_EMAIL`, `TEST_SUPABASE_SENHA` existirem (projeto de teste separado; `describe.skipIf`). Antes de cada teste, apaga as linhas do usuário de teste.
  - `mapeamento.test.ts`: ida e volta `pacienteParaLinha`/`linhaParaPaciente` (e o mesmo para sessão, responsável, horário com `hora` `'14:00'` ↔ `'14:00:00'`) preserva todos os campos.
- [ ] **Step 2: Rodar e ver falhar** — `npm test -- src/dados` → FAIL.
- [ ] **Step 3: Implementar** `memoria.ts` (Maps + `crypto.randomUUID()`), `mapeamento.ts`, `supabase.ts` (`upsert` com `{ onConflict: 'horario_fixo_id,data_ocorrencia', ignoreDuplicates: true }` em `inserirOcorrencias`; `listarSessoes` converte `de`/`ate` em instantes com `instanteDe(de,'00:00')` e `instanteDe(somarDias(ate,1),'00:00')`), `semente-demo.ts` (4 pacientes fictícios: “Ana Clara Souza” psicoterapia mensal R$ 200, terça 14:00; “Pedro Henrique Lima” avaliação 10 sessões, quarta 09:00, com 3 sessões já realizadas; “Maria Luísa Costa” psicoterapia por sessão R$ 180, quinta 16:00, sem telefone; “Lucas Oliveira” lista de espera; responsáveis com telefones `(85) 90000-000X`), `contexto.tsx`.
- [ ] **Step 4: Rodar e ver passar** — `npm test -- src/dados` → PASS (contrato Supabase aparece como `skipped`).
- [ ] **Step 5: Commit** — `git commit -m "Adiciona repositório em memória e Supabase com testes de contrato"`

---

### Task 5: Serviços da agenda e dos pacientes

**Files:**
- Create: `src/servicos/agenda.ts`, `src/servicos/pacientes.ts`
- Test: `src/servicos/agenda.test.ts`, `src/servicos/pacientes.test.ts`

**Interfaces:**
- Consumes: `Repositorio` (Task 4), regras (Task 3), `CONFIGURACOES_PADRAO`, `ETAPAS_AVALIACAO_PADRAO`.
- Produces (`servicos/agenda.ts`):
  - `garantirAgenda(repo: Repositorio, hoje: DataISO, semanas: number): Promise<number>` — janela `hoje`..`somarDias(hoje, semanas*7 - 1)`.
  - `marcarSituacao(repo, sessao: Sessao, situacao: Exclude<SituacaoSessao, 'remarcada'>): Promise<Sessao>` — se `compareceu` e o paciente não tem `dataEntrada`, grava `dataEntrada = dataLocal(sessao.inicio)`.
  - `remarcar(repo, sessao: Sessao, novoInicio: string): Promise<Sessao>` — cria a nova (`origem: 'remarcacao'`, mesmo paciente/tipo/avaliação/acompanhamento, `horarioFixoId: null`, `dataOcorrencia: null`, `situacao: 'agendada'`), marca a original `remarcada` com `remarcadaPara`; devolve a nova.
  - `criarAvulsa(repo, dados: { pacienteId: Id; inicio: string; duracaoMin: number; acompanhamentoFamiliar: boolean }): Promise<Sessao>` — tipo e avaliação vêm da ficha.
  - `bloquearPeriodo(repo, b: Omit<Bloqueio, 'id'>): Promise<{ bloqueio: Bloqueio; canceladas: number }>` — cancela as `agendada` do período com `observacao = b.motivo`.
- Produces (`servicos/pacientes.ts`):
  - `criarPaciente(repo, dados: Omit<Paciente, 'id'>, config: Configuracoes, hoje: DataISO): Promise<Paciente>` — se `tipo === 'avaliacao'`, cria `Avaliacao` (`inicio = dados.dataEntrada ?? hoje`, `sessoesPrevistas = config.sessoesAvaliacaoPadrao`, etapas padrão não feitas).
  - `mudarHorarioFixo(repo, horario: HorarioFixo, novo: Pick<HorarioFixo, 'diaSemana' | 'hora' | 'duracaoMin'>, aPartirDe: DataISO, semanas: number): Promise<HorarioFixo>` — encerra o antigo (`validoAte = somarDias(aPartirDe, -1)`), cria o novo (`validoDe = aPartirDe`), remove as `agendada` fixas do antigo a partir de `aPartirDe`, chama `garantirAgenda(repo, aPartirDe, semanas)`.
  - `mudarTipo(repo, pacienteId: Id, novoTipo: TipoAtendimento, hoje: DataISO, config: Configuracoes): Promise<void>` — atualiza o paciente; remove as `agendada` **fixas** a partir de `hoje`; se virou avaliação, cria a avaliação; chama `garantirAgenda`.
  - `darAlta(repo, pacienteId: Id, data: DataISO): Promise<void>` — `status 'alta'`, `dataAlta = data`, encerra horários (`validoAte = data`), remove todas as `agendada` depois de `data`.

- [ ] **Step 1: Escrever os testes que falham** (todos com `criarRepositorioMemoria` e uma semente mínima)

```ts
it('garantirAgenda é idempotente', async () => {
  expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(4);
  expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(0);
  expect(await repo.listarSessoes('2026-11-02', '2026-11-29')).toHaveLength(4);
});
it('compareceu preenche a data de entrada só na primeira vez', async () => { /* dataEntrada null → '2026-11-03'; segunda sessão não altera */ });
it('remarcar cria nova sessão e marca a original', async () => {
  const nova = await remarcar(repo, s, '2026-11-05T13:00:00.000Z');
  // original: situacao 'remarcada', remarcadaPara = nova.id; nova: origem 'remarcacao', situacao 'agendada'
  // garantirAgenda de novo não recria a ocorrência original
});
it('bloqueio cancela só agendadas (Review Focus 5)', async () => {
  // 11-03 compareceu, 11-10 agendada, 11-17 agendada; bloqueio 11-01..11-15 'Férias'
  // → canceladas = 1; 11-03 continua 'compareceu'; 11-10 'cancelada' com observacao 'Férias'; 11-17 'agendada'
});
it('mudarHorarioFixo move as futuras e preserva o passado', async () => { /* terça→quinta a partir de 11-10: 11-03 fica; 11-12, 11-19… criadas; 11-10, 11-17 removidas */ });
it('mudarTipo atualiza sessões futuras e preserva o histórico (Review Focus 4)', async () => {
  // avaliação com 2 realizadas + 2 agendadas futuras → psicoterapia
  // realizadas continuam tipo 'avaliacao'; futuras regeneradas como 'psicoterapia'
});
it('criarPaciente em avaliação cria avaliação com 10 sessões e 5 etapas', async () => { /* … */ });
it('darAlta encerra horários e remove futuras agendadas', async () => { /* … */ });
```
- [ ] **Step 2: Rodar e ver falhar** — `npm test -- src/servicos` → FAIL.
- [ ] **Step 3: Implementar** os serviços com as assinaturas acima.
- [ ] **Step 4: Rodar e ver passar** — `npm test -- src/servicos` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Adiciona serviços de agenda e pacientes"`

---

### Task 6: Login

**Files:**
- Create: `src/dados/autenticacao.ts`, `src/telas/login/TelaLogin.tsx`, `src/componentes/ExigeLogin.tsx`, `src/componentes/Botao.tsx`, `src/componentes/Campo.tsx`
- Modify: `src/App.tsx` (rota `/entrar`, rotas internas dentro de `ExigeLogin`), `src/telas/mais/TelaMais.tsx` (botão “Sair”)
- Test: `src/telas/login/TelaLogin.test.tsx`

**Interfaces:**
- Produces: `interface Autenticacao { usuarioAtual(): Promise<Usuario | null>; entrar(email: string, senha: string): Promise<void>; sair(): Promise<void>; aoMudar(cb: (u: Usuario | null) => void): () => void }`; `type Usuario = { id: string; email: string }`; `class ErroAutenticacao extends Error`; `criarAutenticacaoSupabase(cliente)`; `criarAutenticacaoDemo()` (sempre logada como `{ id: 'demo', email: 'demonstracao@consultorio' }`); `AutenticacaoProvider`, `useAutenticacao()`.
- Mensagens exatas: credenciais erradas → “E-mail ou senha incorretos.”; falha de rede → “Sem conexão. Verifique a internet e tente de novo.”
- No modo demonstração, todas as telas mostram uma faixa amarela no topo: “Modo demonstração — os dados são fictícios e não são salvos.”

- [ ] **Step 1: Escrever os testes que falham** — com uma `Autenticacao` falsa: (a) tela mostra logo completa, campos “E-mail” e “Senha” e botão “Entrar”; (b) envio com credenciais erradas mostra “E-mail ou senha incorretos.” e mantém o e-mail digitado; (c) sucesso navega para `/agenda`; (d) acessar `/pacientes` sem login redireciona para `/entrar` e, após entrar, volta para `/pacientes`; (e) “Sair” em Mais volta para `/entrar`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — `Botao` e `Campo` com altura mínima 44 px, rótulo visível e mensagem de erro ligada por `aria-describedby`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Adiciona login com Supabase e modo demonstração"`

---

### Task 7: Configurações e parceiros

**Files:**
- Create: `src/telas/mais/TelaConfiguracoes.tsx`, `src/telas/mais/TelaParceiros.tsx`, `src/dados/useConfiguracoes.ts`
- Modify: `src/telas/mais/TelaMais.tsx` (links), `src/App.tsx` (rotas `/mais/configuracoes`, `/mais/parceiros`)
- Test: `src/telas/mais/TelaConfiguracoes.test.tsx`, `src/telas/mais/TelaParceiros.test.tsx`

**Interfaces:**
- Consumes: `Repositorio.obterConfiguracoes/salvarConfiguracoes/listarParceiros/salvarParceiro/removerParceiro`, `CONFIGURACOES_PADRAO`.
- Produces: `useConfiguracoes(): { config: Configuracoes; carregando: boolean }` — quando `obterConfiguracoes()` devolve `null`, grava e devolve `CONFIGURACOES_PADRAO` (primeiro acesso).

- [ ] **Step 1: Escrever os testes que falham** — (a) primeiro acesso: tela já vem com “Juliana Queiroz Feliciano”, “CRP 11/16479” e a mensagem padrão do WhatsApp, e o repositório passa a ter configurações; (b) mudar “Duração padrão da sessão” para 45 e salvar → `obterConfiguracoes()` devolve 45 e aparece “Configurações salvas.”; (c) duração 0 ou vazia mostra “Informe um número maior que zero.” e não salva; (d) a mensagem do WhatsApp mostra os campos disponíveis `{responsável}`, `{paciente}`, `{dia}`, `{hora}`; (e) parceiros: adicionar “Dra. Marta Ribeiro — Neuropediatra”, editar, remover com confirmação.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — campos agrupados em “Seus dados” e “Agenda” (duração padrão, sessões da avaliação, semanas geradas, mensagem do WhatsApp).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Adiciona configurações e parceiros"`

---

### Task 8: Pacientes — lista e ficha

**Files:**
- Create: `src/regras/dinheiro.ts`, `src/dominio/rotulos.ts`, `src/telas/pacientes/TelaPacientes.tsx`, `src/telas/pacientes/FichaPaciente.tsx`, `src/telas/pacientes/SecaoDados.tsx`, `src/telas/pacientes/SecaoResponsaveis.tsx`, `src/telas/pacientes/SecaoHorarios.tsx`, `src/telas/pacientes/SecaoAvaliacao.tsx`, `src/telas/pacientes/SecaoSessoes.tsx`
- Modify: `src/App.tsx` (rotas `/pacientes/novo`, `/pacientes/:id`)
- Test: `src/regras/dinheiro.test.ts`, `src/telas/pacientes/TelaPacientes.test.tsx`, `src/telas/pacientes/FichaPaciente.test.tsx`

**Interfaces:**
- Consumes: `Repositorio`, `criarPaciente`, `mudarHorarioFixo`, `mudarTipo`, `darAlta`, `garantirAgenda` (Task 5), `useConfiguracoes` (Task 7).
- Produces: `formatarReais(centavos: number): string`; `lerReais(texto: string): number | null`; `ROTULO_SITUACAO: Record<SituacaoSessao, string>`, `ICONE_SITUACAO: Record<SituacaoSessao, LucideIcon>`, `type TipoVisual = TipoAtendimento | 'familiar'`, `ROTULO_TIPO: Record<TipoVisual, string>`, `COR_TIPO: Record<TipoVisual, string>` (`avaliacao: 'amarelo'`, `psicoterapia: 'laranja'`, `familiar: 'azul-claro'`), `tipoVisual(s: Sessao): TipoVisual` (`'familiar'` quando `acompanhamentoFamiliar`); `<ChipSituacao situacao />` em `src/componentes/ChipSituacao.tsx`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(formatarReais(18000)).toBe('R$ 180,00');      // com espaço não separável: use toMatch(/R\$\s180,00/)
expect(lerReais('180')).toBe(18000);
expect(lerReais('R$ 1.250,50')).toBe(125050);
expect(lerReais('abc')).toBeNull();
```
  Interface (com repositório em memória e semente):
  - Lista: grupos na ordem “Em avaliação”, “Em psicoterapia”, “Lista de espera”, “Alta”; contagem em cada grupo; busca “ana” ignora maiúsculas e acentos (“Ána” acha “Ana Clara”); botão “Novo paciente”.
  - Novo paciente: nome obrigatório (“Informe o nome.”); tipo obrigatório; ao salvar em avaliação, a ficha mostra “Avaliação · sessão 1 de 10” e as 5 etapas.
  - Responsáveis: adicionar dois, marcar o segundo como principal → só ele aparece com o selo “Principal”.
  - Horários: adicionar “Terça, 14:00, 50 min” → a seção “Sessões” mostra as próximas 4 terças; “Mudar horário” pergunta “A partir de quando?” e aplica `mudarHorarioFixo`.
  - Cobrança: escolher “Por mês” e valor “200” → salva `valorSessaoCentavos = 20000` e mostra “R$ 200,00”.
  - Mudar de “Avaliação” para “Psicoterapia” pede confirmação e chama `mudarTipo`.
  - “Dar alta” pede data e confirmação → paciente vai para o grupo “Alta”.
  - Etapas da avaliação: marcar “Devolutiva” persiste; “Adicionar etapa” acrescenta uma etapa nova.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — ficha em seções recolhíveis no celular; telefone com máscara `(85) 98823-2033`; CPF com máscara `000.000.000-00` (opcional); campo “Quem encaminhou” lista os parceiros. As abas “Documentos” e “Financeiro” da ficha ficam para os próximos planos (não aparecem ainda).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Adiciona lista e ficha de pacientes"`

---

### Task 9: Agenda — semana, painel da sessão e bloqueios

**Files:**
- Create: `src/telas/agenda/TelaAgenda.tsx`, `src/telas/agenda/GradeSemana.tsx`, `src/telas/agenda/CartaoSessao.tsx`, `src/telas/agenda/PainelSessao.tsx`, `src/telas/agenda/DialogoAvulsa.tsx`, `src/telas/agenda/DialogoBloqueio.tsx`, `src/componentes/Folha.tsx`
- Test: `src/telas/agenda/TelaAgenda.test.tsx`, `src/telas/agenda/PainelSessao.test.tsx`

**Interfaces:**
- Consumes: `garantirAgenda`, `marcarSituacao`, `remarcar`, `criarAvulsa`, `bloquearPeriodo` (Task 5); `numeroNaAvaliacao` (Task 3); `ChipSituacao`, `COR_TIPO` (Task 8); `useConfiguracoes` (Task 7).
- Produces: `<Folha aberta onFechar titulo>` (painel inferior no celular, lateral a partir de 768 px, fecha com Esc e com o botão “Fechar”).

Comportamento fixado:
- Ao abrir a agenda: `garantirAgenda(repo, hojeISO(), config.semanasGeradas)` uma vez por abertura.
- Celular (< 768 px): um dia por vez, com seletor de dias da semana (Seg…Sáb, domingo só se houver sessão) e setas “Semana anterior” / “Próxima semana”; abre no dia de hoje. A partir de 768 px: 7 colunas (domingo oculto se vazio).
- Cartão: hora local, nome do paciente, faixa lateral na cor do tipo (azul-claro quando `acompanhamentoFamiliar`), rótulo do tipo, `ChipSituacao`, “sessão X de N” em avaliação, ícone de confirmado.
- Painel da sessão: botões “Compareceu”, “Faltou com aviso”, “Faltou sem aviso”, “Cancelar sessão”; “Remarcar” (data + hora); alternância “Acompanhamento familiar”; campo “Observação”. Sessões `remarcada` mostram “Remarcada para {dia}, {hora}” e não têm botões de situação.
- “+” abre a sessão avulsa (paciente, data, hora, duração padrão, acompanhamento familiar).
- “Bloquear dias” (início, fim, motivo) → mostra “{n} sessões canceladas.”

- [ ] **Step 1: Escrever os testes que falham** — com relógio fixo em `2026-11-02T12:00:00-03:00` (`vi.setSystemTime`) e semente demo: (a) a semana de 02/11 mostra a sessão de Ana Clara na terça às 14:00 com “Psicoterapia” e “Agendada”; (b) a sessão de Pedro Henrique mostra “sessão 4 de 10”; (c) tocar no cartão, “Compareceu” → o chip vira “Compareceu”; (d) “Remarcar” para 05/11 15:00 → terça mostra “Remarcada” e quinta mostra a nova sessão “Agendada”; (e) ligar “Acompanhamento familiar” muda o rótulo do cartão para “Acompanhamento familiar”; (f) bloquear 10/11–14/11 “Feriado” → aviso com o número de sessões canceladas e, na semana seguinte, os cartões aparecem “Cancelada”; (g) “Próxima semana” mostra 09/11–15/11; (h) sessão avulsa criada aparece no dia e hora escolhidos.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** com TanStack Query (`['sessoes', de, ate]`; invalidar após cada mudança).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Adiciona agenda semanal, painel da sessão e bloqueios"`

---

### Task 10: Lista de amanhã e WhatsApp

**Files:**
- Create: `src/regras/whatsapp.ts`, `src/telas/agenda/ListaDoDia.tsx`
- Modify: `src/telas/agenda/TelaAgenda.tsx` (aviso “Amanhã: N pacientes” no topo)
- Test: `src/regras/whatsapp.test.ts`, `src/telas/agenda/ListaDoDia.test.tsx`

**Interfaces:**
- Consumes: `Repositorio.listarSessoes`, `atualizarSessao`; `diaPorExtenso`, `horaLocal`, `somarDias` (Task 3); `config.mensagemWhatsapp` (Task 7).
- Produces: `normalizarTelefone(tel: string): string | null`; `primeiroNome(nome: string): string`; `preencherMensagem(modelo: string, campos: Record<string, string>): string`; `linkWhatsApp(telefone: string, mensagem: string): string | null`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(normalizarTelefone('(85) 98823-2033')).toBe('5585988232033');
expect(normalizarTelefone('+55 85 98823-2033')).toBe('5585988232033');
expect(normalizarTelefone('8532221100')).toBe('558532221100');
expect(normalizarTelefone('98823')).toBeNull();
expect(primeiroNome('  Ana Clara Souza ')).toBe('Ana');
expect(preencherMensagem('Olá, {responsável}! {paciente} às {hora}. {outro}', { 'responsável': 'Marta', paciente: 'Ana', hora: '14:00' }))
  .toBe('Olá, Marta! Ana às 14:00. {outro}');
expect(linkWhatsApp('(85) 98823-2033', 'Olá, Marta!')).toBe('https://wa.me/5585988232033?text=Ol%C3%A1%2C%20Marta!');
expect(linkWhatsApp('', 'x')).toBeNull();
```
  Interface (relógio em `2026-11-02T12:00:00-03:00`, semente demo):
  - O topo da agenda mostra “Amanhã: 1 paciente” (terça 03/11: Ana Clara); singular/plural corretos; “Amanhã: nenhum paciente” quando vazio.
  - Abrir a lista mostra hora, paciente, responsável principal e telefone; o botão “WhatsApp” é um link `target="_blank"` cujo `href` contém a mensagem preenchida com o primeiro nome do responsável, o primeiro nome do paciente, `terça-feira, 03/11` e `14:00`.
  - Paciente sem telefone (Maria Luísa, quinta) mostra “sem telefone” e nenhum botão de WhatsApp (Review Focus 3).
  - A caixa “Confirmado” grava `confirmada = true` e o cartão da agenda passa a mostrar o ícone de confirmado.
  - Setas mudam o dia da lista; só aparecem sessões `agendada`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Adiciona lista de amanhã com WhatsApp e confirmação"`

---

### Task 11: Teste de ponta a ponta, guia de instalação e entrega

**Files:**
- Create: `playwright.config.ts`, `e2e/fluxo-principal.spec.ts`, `docs/instalacao.md`
- Modify: `README.md` (como rodar, modo demonstração, link para a instalação)

**Interfaces:**
- Consumes: o aplicativo inteiro em modo demonstração (`npm run dev` sem variáveis `VITE_SUPABASE_*`).

- [ ] **Step 1: Escrever o teste E2E que falha** — `playwright.config.ts` com `webServer: { command: 'npm run dev -- --port 5173', port: 5173 }` e dois projetos: “celular” (`devices['iPhone 13']` com `browserName: 'chromium'`) e “notebook” (1280 × 800). Em `fluxo-principal.spec.ts`, com `page.clock.setFixedTime(new Date('2026-11-02T12:00:00-03:00'))`:
  1. abre `/` → vê a faixa do modo demonstração e “Amanhã: 1 paciente”;
  2. vai a Pacientes → “Novo paciente” → “Beatriz Teste”, psicoterapia, por sessão, R$ 150, responsável “Carla” `(85) 90000-0009` principal, horário segunda 10:00 → salva;
  3. volta à Agenda → próxima semana → segunda 09/11 mostra “Beatriz Teste 10:00”;
  4. abre a sessão → “Compareceu” → chip “Compareceu”;
  5. nenhuma mensagem de erro no console (`page.on('console')` filtrando `error`).
- [ ] **Step 2: Rodar** — `npm run e2e` → deve passar nos dois projetos (se falhar, corrigir o código, não o teste).
- [ ] **Step 3: Escrever `docs/instalacao.md`** — passo a passo para leiga, com prints descritos em texto:
  1. Supabase: criar conta, projeto `consultorio` na região **South America (São Paulo)**, senha do banco guardada; SQL Editor → colar e rodar `supabase/migrations/20261023120000_base.sql`; Authentication → Users → “Add user” com seu e-mail e senha forte; Authentication → Sign In / Providers → desligar “Allow new users to sign up”; Project Settings → API → copiar **Project URL** e **Publishable key**.
  2. Cloudflare: criar conta; Workers & Pages → Create → Pages → conectar o GitHub e escolher `consultorio`; framework “Vite”, build `npm run build`, saída `dist`; variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; publicar e anotar o endereço `….pages.dev`.
  3. No celular e no iPad (Safari): abrir o endereço → Compartilhar → “Adicionar à Tela de Início”. No notebook (Chrome): ícone de instalar na barra de endereço.
  4. Primeiro acesso: entrar, conferir “Mais → Configurações”, cadastrar parceiros, pacientes e horários.
  5. (Opcional, para testes automáticos) segundo projeto Supabase `consultorio-teste` e as variáveis `TEST_SUPABASE_*`.
- [ ] **Step 4: Verificação final** — `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → tudo passa; abrir `npm run preview` e conferir manualmente, em 390 × 844 e 1280 × 800: logo, cores, fontes Prata/Nunito Sans, ícone do app no manifesto.
- [ ] **Step 5: Commit** — `git commit -m "Adiciona teste de ponta a ponta e guia de instalação"`

---

## Depois deste plano

Com o guia de instalação seguido, o sistema já roda no celular, no iPad e no notebook com agenda, pacientes e lista de amanhã. O próximo plano é a **Etapa 3 — Cobrança** (valor de cada sessão, pagamentos por sessão, mensalidade, pacote da avaliação, falta sem aviso cobrada, “a receber”), que acrescenta uma nova migração e a parte de pagamento ao painel da sessão.
