# Etapa 3 — Cobrança: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar certo e saber quem deve. Cada sessão guarda o seu valor e há pagamentos por sessão, por mês e do pacote da avaliação (com desconto). A falta sem aviso é cobrada. Há a lista "a receber", a parte financeira na ficha e no painel da sessão, e a aba Financeiro deixa de estar "em construção".

**Architecture:** O mesmo desenho das Etapas 1 e 2. As regras de cobrança são funções puras em `src/regras/cobranca.ts`. As operações ficam em `src/servicos/cobranca.ts` e usam o `Repositorio`, que ganha pagamentos e é implementado em memória e no Supabase, com a suíte de contrato. O registro de pagamento no Supabase é uma função SQL (`registrar_pagamento`), atômica, com unicidade garantida pelo banco.

**Tech Stack:** a mesma do projeto. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-21-sistema-consultorio-design.md`: §4.2 (ficha: valores da avaliação e aba Financeiro), §4.3 (Financeiro: a receber e pagamentos), §5.2 (o que é cobrado), §6 inteiro e §9.1 (definição de "a receber"). Pendências que este plano resolve: `docs/superpowers/pendencias-etapas-1-e-2.md` (seção "Para o plano da Etapa 3").

**Fora deste plano:**
- despesas, recibos, relatórios e carnê-leão (Etapa 6);
- registro com o Claude (Etapa 4);
- documentos (Etapa 5);
- readmitir paciente com alta;
- editar a duração de uma sessão;
- remover bloqueio;
- a sessão "fantasma" de um horário criado depois da hora de hoje.

## Global Constraints

- Todas as restrições das Etapas 1 e 2 continuam valendo (`docs/superpowers/plans/2026-10-23-etapas-1-e-2-base-e-agenda.md`, Global Constraints):
  - pt-BR;
  - fuso `America/Sao_Paulo`;
  - centavos inteiros;
  - paleta e fontes do kit;
  - situações com texto e ícone;
  - 44 px;
  - nada de paciente em Web Storage;
  - RLS em toda tabela;
  - `npm run typecheck`, `npm run lint` e `npm test` antes de cada commit.
- O mês de uma sessão é o mês da sua data LOCAL (`dataLocal(inicio)`), nunca o mês UTC.
- Rótulos exatos:
  - formas de pagamento: `Pix`, `Dinheiro`, `Cartão`, `Transferência`;
  - situação de cobrança: `Pago`, `Pendente`, `Devendo`, `Em andamento`;
  - tipos de desconto: `Sem desconto`, `Em reais`, `Em porcentagem`.
- Mês por extenso em minúsculas: `novembro de 2026`.
- Toda tabela nova recebe `dono … default auth.uid()`, RLS `dono = auth.uid()`, `grant` para `authenticated`, e nenhum acesso para `anon`.
- Multi-escritas na interface invalidam as consultas em `onSettled` (lição da Etapa 2).

## Review Focus

1. **Mudar a situação de uma sessão já paga individualmente:** o sistema não pode deixar um pagamento apontando para uma sessão que não é mais cobrada. Ele recusa com a mensagem exata da Task 4. Teste na Task 4.
2. **Reajuste do valor do paciente depois de sessões já marcadas:** as sessões antigas mantêm o valor de então, e o total do mês soma os valores guardados. Teste nas Tasks 2 e 4.
3. **Mês já pago em que uma sessão muda de situação:** aparece o aviso de diferença (spec §6.3). Teste nas Tasks 2 e 7.
4. **Pagamento registrado duas vezes** (toque duplo ou dois aparelhos), para a mesma sessão ou o mesmo mês: o banco recusa e não há duplicata. Teste nas Tasks 1 e 3.
5. **Sessão às 23:30 do dia 31/10 em São Paulo** (02:30 UTC de 01/11): pertence a outubro. Teste na Task 2.

---

## Estrutura de arquivos

```
supabase/migrations/20261101120000_cobranca.sql     # colunas novas, pagamentos, pagamento_sessoes, registrar_pagamento()
supabase/tests/cobranca.test.ts                       # RLS, unicidade, função, pino das colunas do mapeamento
src/dominio/tipos.ts                                  # tipos novos (modificar)
src/dominio/padroes.ts                                # valorAvaliacaoPadraoCentavos (modificar)
src/dominio/rotulos.ts                                # ROTULO_FORMA, ROTULO_DESCONTO (modificar)
src/regras/cobranca.ts (+ .test.ts)                   # regras puras
src/dados/repositorio.ts, memoria.ts, supabase.ts, mapeamento.ts, repositorio.contrato.ts, semente-demo.ts (modificar)
src/servicos/cobranca.ts (+ .test.ts)                 # registrar/remover pagamento, reposição
src/servicos/agenda.ts, pacientes.ts (+ testes)       # valor ao marcar, bloqueio de sessão paga, mudarTipo conciliador
src/dados/useCobranca.ts                              # hooks de cobrança
src/componentes/FormularioPagamento.tsx               # formulário compartilhado
src/telas/agenda/CobrancaDaSessao.tsx, ReposicaoDaSessao.tsx
src/telas/pacientes/SecaoFinanceiro.tsx, ValoresDaAvaliacao.tsx
src/telas/financeiro/TelaFinanceiro.tsx, ListaAReceber.tsx, ListaPagamentos.tsx
e2e/cobranca.spec.ts
```

---

### Task 1: Migração da cobrança

**Files:**
- Create: `supabase/migrations/20261101120000_cobranca.sql`
- Test: `supabase/tests/cobranca.test.ts` (usa `criarBanco`, `comoUsuario`, `comoAnonimo` e `criarUsuario` de `supabase/tests/banco.ts`)

**Interfaces:**
- Produces:
  - `alter default privileges in schema public revoke all on tables from anon;` no início do arquivo.
  - `configuracoes.valor_avaliacao_padrao_centavos int not null default 0 check (>= 0)`.
  - `sessoes.valor_centavos int check (valor_centavos is null or valor_centavos >= 0)`.
  - Em `avaliacoes`:
    - `valor_previsto_centavos int not null default 0 check (>= 0)`;
    - `desconto_tipo text not null default 'nenhum' check (in ('nenhum','reais','percentual'))`;
    - `desconto_valor int not null default 0 check (desconto_valor >= 0)`;
    - check composto `desconto_tipo <> 'percentual' or desconto_valor <= 100`.
  - `pagamentos` (`id`, `dono`, `criado_em` como nas outras tabelas):
    - `paciente_id uuid not null references pacientes on delete cascade`;
    - `data date not null`;
    - `valor_centavos int not null check (> 0)`;
    - `forma text not null check (in ('pix','dinheiro','cartao','transferencia'))`;
    - `observacao text`;
    - `referencia text not null check (in ('sessoes','mes','avaliacao'))`;
    - `mes_referencia date` (sempre o dia 1), com check `(referencia = 'mes') = (mes_referencia is not null)`;
    - `avaliacao_id uuid references avaliacoes on delete restrict`, com check `(referencia = 'avaliacao') = (avaliacao_id is not null)`;
    - índice único parcial `(paciente_id, mes_referencia) where referencia = 'mes'`.
  - `pagamento_sessoes`:
    - `pagamento_id uuid not null references pagamentos on delete cascade`;
    - `sessao_id uuid not null references sessoes on delete restrict`;
    - `dono`;
    - `primary key (pagamento_id, sessao_id)`;
    - **`unique (sessao_id)`**.
  - Função `registrar_pagamento(p_paciente_id uuid, p_data date, p_valor_centavos int, p_forma text, p_observacao text, p_referencia text, p_mes_referencia date, p_avaliacao_id uuid, p_sessao_ids uuid[]) returns pagamentos`:
    - `language plpgsql`, `security invoker`;
    - insere o pagamento e as ligações numa única transação e devolve a linha;
    - `grant execute … to authenticated`.
  - RLS e políticas `dono_tudo` nas duas tabelas novas; `grant select, insert, update, delete … to authenticated`.

- [ ] **Step 1: Escrever os testes que falham**
  1. As tabelas novas têm RLS. Uma usuária não vê os pagamentos da outra, e `anon` recebe `permission denied`.
  2. `registrar_pagamento` com 2 sessões cria 1 pagamento e 2 ligações.
  3. Chamar de novo para uma das mesmas sessões rejeita (`unique`), e o total de pagamentos continua 1 (atomicidade, Review Focus 4).
  4. Dois pagamentos `referencia='mes'` para o mesmo paciente e `mes_referencia='2026-10-01'` rejeitam.
  5. `referencia='mes'` sem `mes_referencia` rejeita (check).
  6. `desconto_tipo='percentual'` com `desconto_valor=120` rejeita.
  7. Remover uma sessão ligada a pagamento rejeita (`restrict`).
  8. Remover o pagamento remove as ligações (`cascade`).
  9. Uma tabela criada **depois** da migração não dá acesso a `anon`. Crie uma tabela de teste como superusuário e confira `has_table_privilege('anon', …, 'select') = false`.
- [ ] **Step 2: Rodar e ver falhar:** `npm test -- supabase/tests/cobranca.test.ts` → FAIL.
- [ ] **Step 3: Escrever a migração** conforme as Interfaces.
- [ ] **Step 4: Rodar e ver passar:** `npm test -- supabase/tests` → PASS. Os testes da base continuam passando.
- [ ] **Step 5: Commit:** `git commit -m "Adiciona migração da cobrança com pagamentos e RLS"`

---

### Task 2: Regras de cobrança

**Files:**
- Modify: `src/dominio/tipos.ts`, `src/dominio/padroes.ts`, `src/dominio/rotulos.ts`
- Create: `src/regras/cobranca.ts`
- Test: `src/regras/cobranca.test.ts`

**Interfaces:**
- Produces (tipos):
  ```ts
  export type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia';
  export type ReferenciaPagamento = 'sessoes' | 'mes' | 'avaliacao';
  export type TipoDesconto = 'nenhum' | 'reais' | 'percentual';
  // Configuracoes += valorAvaliacaoPadraoCentavos: number   (padrão 0)
  // Sessao        += valorCentavos: number | null           (null enquanto não é cobrada)
  // Avaliacao     += valorPrevistoCentavos: number; descontoTipo: TipoDesconto; descontoValor: number
  export interface Pagamento { id: Id; pacienteId: Id; data: DataISO; valorCentavos: number; forma: FormaPagamento; observacao: string | null; referencia: ReferenciaPagamento; mesReferencia: DataISO | null; avaliacaoId: Id | null; sessaoIds: Id[] }
  export type NovoPagamento = Omit<Pagamento, 'id'>;
  ```
- Produces (`rotulos.ts`): `ROTULO_FORMA: Record<FormaPagamento, string>` e `ROTULO_DESCONTO: Record<TipoDesconto, string>`, com os rótulos exatos das Global Constraints.
- Produces (`src/regras/cobranca.ts`):
  - `valorCobradoDaSessao(s: Pick<Sessao, 'tipo' | 'situacao'>, valorSessaoCentavos: number): number | null`:
    - psicoterapia (inclusive acompanhamento familiar) com `ehCobravel(situacao)` → o valor;
    - avaliação → o valor **só** quando `falta_sem_aviso` (o comparecimento faz parte do pacote, §6.4);
    - qualquer outro caso → `null`.
  - `valorFinalDaAvaliacao(a: Pick<Avaliacao, 'valorPrevistoCentavos' | 'descontoTipo' | 'descontoValor'>): number`:
    - reais → `max(0, previsto − desconto)`;
    - percentual → `Math.round(previsto × (100 − p) / 100)`;
    - nenhum → previsto.
  - `mesDaSessao(inicio: string): DataISO`: o dia 1 do mês local.
  - `mesPorExtenso(mes: DataISO): string` → `'novembro de 2026'`.
  - `pendenciasDoPaciente(e: { paciente: Paciente; sessoes: Sessao[]; pagamentos: Pagamento[]; avaliacao: Avaliacao | null; hoje: DataISO }): Pendencias`, onde
    ```ts
    export interface MesCobranca { mes: DataISO; sessoes: Sessao[]; totalCentavos: number; situacao: 'em_andamento' | 'devendo' | 'pago'; pagamento: Pagamento | null; diferencaCentavos: number }
    export interface Pendencias {
      sessoesAbertas: Sessao[];          // cobradas individualmente e ainda sem pagamento, da mais antiga para a mais nova
      meses: MesCobranca[];              // só para quem paga por mês; do mais antigo para o mais novo
      avaliacao: { valorFinalCentavos: number; pagoCentavos: number; faltaCentavos: number } | null;
      totalEmAbertoCentavos: number;     // sessões abertas + meses não pagos (inclusive o em andamento) + falta da avaliação
      desde: DataISO | null;             // data do item em aberto mais antigo
    }
    ```
    - **Regra de agrupamento:** entra em sessão avulsa de cobrança toda sessão com `valorCentavos !== null` que seja falta sem aviso da avaliação ou de paciente `por_sessao`. Psicoterapia de paciente `mensal` vai para o mês da sessão. Sessão já ligada a um pagamento `referencia='sessoes'` nunca entra em mês.
    - **Situação do mês:** com pagamento `referencia='mes'` → `pago`, com `diferencaCentavos = total − pago` (pode ser 0, positiva ou negativa). Sem pagamento: é o mês de `hoje` → `em_andamento`; mês passado com total > 0 → `devendo`. Mês com total 0 e sem pagamento não aparece.
  - `resumoAReceber(itens: { paciente: Paciente; pendencias: Pendencias }[]): { paciente: Paciente; totalCentavos: number; desde: DataISO | null }[]`: só quem tem total > 0, do `desde` mais antigo para o mais novo.

- [ ] **Step 1: Escrever os testes que falham**
```ts
expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao: 'compareceu' }, 18000)).toBe(18000);
expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao: 'falta_sem_aviso' }, 18000)).toBe(18000);
expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao: 'falta_com_aviso' }, 18000)).toBeNull();
expect(valorCobradoDaSessao({ tipo: 'avaliacao', situacao: 'compareceu' }, 16000)).toBeNull();
expect(valorCobradoDaSessao({ tipo: 'avaliacao', situacao: 'falta_sem_aviso' }, 16000)).toBe(16000);
expect(valorFinalDaAvaliacao({ valorPrevistoCentavos: 180000, descontoTipo: 'percentual', descontoValor: 15 })).toBe(153000);
expect(valorFinalDaAvaliacao({ valorPrevistoCentavos: 180000, descontoTipo: 'reais', descontoValor: 200000 })).toBe(0);
expect(mesDaSessao('2026-11-01T02:30:00.000Z')).toBe('2026-10-01');            // Review Focus 5
expect(mesPorExtenso('2026-11-01')).toBe('novembro de 2026');
```
Casos de `pendenciasDoPaciente`, com `hoje = '2026-11-02'`:
- **Mensal:** 3 sessões de outubro com valor 20000 e nenhuma de novembro → um mês `devendo` com total 60000. Total em aberto 60000 e `desde = '2026-10-01'`.
- **Reajuste (Review Focus 2):** duas sessões de outubro com 20000 e uma com 22000 → total 62000.
- **Mês pago com diferença (Review Focus 3):** pagamento de outubro com 60000, depois uma das sessões passa a valor `null` → `pago`, com `diferencaCentavos = -20000`.
- **Mês em andamento:** sessão de novembro → mês `em_andamento`, que conta no total.
- **Por sessão:** 2 sessões com valor, uma já paga → `sessoesAbertas` só com a outra.
- **Avaliação:** valor final 153000 e pagamentos de 50000 e 30000 → `pagoCentavos` 80000 e `faltaCentavos` 73000. A falta sem aviso de 16000 aparece em `sessoesAbertas`.
- **Resumo:** `resumoAReceber` ordena por `desde` e omite quem tem total 0.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Atualize `CONFIGURACOES_PADRAO` com `valorAvaliacaoPadraoCentavos: 0` e os rótulos.
- [ ] **Step 4: Rodar e ver passar.** Corrija os erros de tipo que os campos novos causarem nos testes e factories existentes: as sessões ganham `valorCentavos: null`, e a avaliação ganha os valores padrão (`0`, `'nenhum'`, `0`).
- [ ] **Step 5: Commit:** `git commit -m "Adiciona regras de cobrança"`

---

### Task 3: Repositório — pagamentos, campos novos e paginação

**Files:**
- Modify: `src/dados/repositorio.ts`, `memoria.ts`, `supabase.ts`, `mapeamento.ts`, `repositorio.contrato.ts`, `semente-demo.ts` (+ testes)
- Test: `src/dados/mapeamento.test.ts`, `supabase/tests/cobranca.test.ts` (pino de colunas)

**Interfaces:**
- Produces (`Repositorio`):
  ```ts
  /** Pagamentos do filtro, por data e depois por criação. Sem filtro: todos. */
  listarPagamentos(filtro?: { pacienteId?: Id; de?: DataISO; ate?: DataISO }): Promise<Pagamento[]>;
  /** Atômico. Rejeita sessão já paga ou mês já pago (mensagem do banco ou da memória). */
  registrarPagamento(p: NovoPagamento): Promise<Pagamento>;
  removerPagamento(id: Id): Promise<void>;
  /** Todas as sessões com valorCentavos não nulo, de todos os pacientes, por início. */
  listarSessoesCobradas(): Promise<SessaoComPaciente[]>;
  ```
- O mapeamento cobre:
  - `configuracoes.valor_avaliacao_padrao_centavos`;
  - `sessoes.valor_centavos`;
  - os 3 campos novos de `avaliacoes`;
  - `pagamentos` com `sessaoIds` (lido de `pagamento_sessoes(sessao_id)` embutido).
- Supabase:
  - `registrarPagamento` usa `cliente.rpc('registrar_pagamento', {...})` e depois relê o pagamento com as ligações;
  - toda listagem que pode passar de 1000 linhas (`listarPagamentos`, `listarSessoesCobradas`, `listarSessoesDoPaciente`, `listarSessoes`) passa por um auxiliar `buscarTodas(fabrica: (de: number, ate: number) => consulta)` que pagina com `.range()` de 1000 em 1000;
  - memória: `registrarPagamento` recusa uma sessão já ligada e um mês já pago, com as mesmas mensagens.
- Semente demo (relativa a `hoje`; com `hoje = '2026-11-02'`):
  - **Ana (mensal, R$ 200):** 4 sessões `compareceu` em outubro (terças), com valor 20000, sem pagamento → outubro `devendo` R$ 800,00.
  - **Maria Luísa (por sessão, R$ 180):** 2 sessões `compareceu` em outubro (quintas). Uma está paga (Pix, no dia), a outra pendente.
  - **Pedro (avaliação):** `valorPrevistoCentavos 180000`, `descontoTipo 'percentual'`, `descontoValor 10` (encaminhado pela parceira), e um pagamento de 81000 (Pix) na data da primeira sessão feita, em outubro. Suas 3 sessões já feitas continuam com valor `null`.
  - Os fatos das Etapas 1 e 2 continuam valendo (testes existentes).

- [ ] **Step 1: Escrever os testes que falham**
  - **Contrato:**
    - ida e volta de `valorCentavos` numa sessão e dos valores da avaliação;
    - `registrarPagamento` de sessões aparece em `listarPagamentos({ pacienteId })` com `sessaoIds`;
    - registrar de novo a mesma sessão rejeita e continua havendo 1 pagamento (Review Focus 4);
    - pagar o mesmo mês duas vezes rejeita;
    - `removerPagamento` libera a sessão para um novo pagamento;
    - `listarPagamentos({ de, ate })` filtra por data inclusive;
    - `listarSessoesCobradas` traz só as sessões com valor, com o nome do paciente.
  - **Pino de colunas (PGlite):** para cada `…ParaLinha` (paciente, responsável, horário, avaliação, sessão, pagamento sem `sessaoIds`, configurações), inserir a linha produzida na tabela migrada correspondente, como usuária. Ela entra sem erro de coluna. Isso pina os nomes das colunas contra o banco real.
  - **Paginação:** um teste do auxiliar `buscarTodas` com uma fábrica falsa que devolve 1000, 1000 e 3 linhas → 2003 linhas e 3 chamadas.
  - **Semente:** os fatos acima (outubro da Ana devendo 80000; Maria com 1 sessão aberta; Pedro com falta de 81000).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** O contrato Supabase continua `skipped` sem as variáveis de teste.
- [ ] **Step 5: Commit:** `git commit -m "Adiciona pagamentos ao repositório, paginação e semente de cobrança"`

---

### Task 4: Serviços de cobrança e ajustes da agenda

**Files:**
- Create: `src/servicos/cobranca.ts`, `src/servicos/cobranca.test.ts`
- Modify: `src/servicos/agenda.ts`, `src/servicos/pacientes.ts` (+ testes)

**Interfaces:**
- Produces:
  - `class ErroCobranca extends Error`.
  - `registrarPagamento(repo, p: { pacienteId: Id; data: DataISO; forma: FormaPagamento; observacao: string | null } & ({ referencia: 'sessoes'; sessaoIds: Id[] } | { referencia: 'mes'; mes: DataISO } | { referencia: 'avaliacao'; valorCentavos: number }), hoje: DataISO): Promise<Pagamento>`. O valor é calculado assim:
    - **sessões:** soma de `valorCentavos`; exige que todas sejam do paciente, tenham valor e estejam abertas. Senão, `ErroCobranca('Escolha só sessões em aberto deste paciente.')`.
    - **mês:** o `totalCentavos` do mês em `pendenciasDoPaciente`; exige o mês não pago e total > 0.
    - **avaliação:** o valor informado, com 0 < valor ≤ `faltaCentavos`. Senão, `ErroCobranca('O valor passa do que falta do pacote: {formatarReais(falta)}.')`.
  - `removerPagamento(repo, id: Id): Promise<void>`.
  - `agendarReposicao(repo, sessao: Sessao, novoInicio: string): Promise<Sessao>`:
    - só para avaliação com `falta_sem_aviso`; senão, `ErroCobranca('A reposição é só para falta sem aviso na avaliação.')`;
    - cria a nova sessão (`origem 'remarcacao'`, mesma avaliação, `situacao 'agendada'`);
    - grava `remarcadaPara` na original **sem mudar a situação**, que continua cobrada.
- Muda:
  - **`marcarSituacao`:**
    - grava também `valorCentavos = valorCobradoDaSessao(sessao com a nova situação, paciente.valorSessaoCentavos)`;
    - se a sessão está ligada a um pagamento `referencia='sessoes'` e a nova situação deixa o valor `null`, rejeita com `ErroCobranca('Esta sessão já foi paga. Para mudar a situação, remova o pagamento na ficha do paciente.')` sem gravar nada (Review Focus 1);
    - mudar entre duas situações cobradas mantém o pagamento e o valor já guardado.
  - **`criarPaciente`:** a avaliação nasce com `valorPrevistoCentavos = config.valorAvaliacaoPadraoCentavos`, `'nenhum'` e `0`.
  - **`mudarTipo` (conciliador, pendência I7):**
    - atualiza **no lugar** o `tipo` e o `avaliacaoId` das sessões agendadas do paciente com `inicio > agora` (fixas, avulsas e remarcações), em vez de apagar e regenerar;
    - não sai cedo quando o tipo já é o novo: só pula a criação da avaliação e o `salvarPaciente`, e continua conciliando as sessões;
    - nova assinatura: `mudarTipo(repo, pacienteId, novoTipo, hoje, config, agora: Date = new Date())`.

- [ ] **Step 1: Escrever os testes que falham** (repositório em memória com `sementeDemo('2026-11-02')` ou fábricas)
  - `marcarSituacao` compareceu numa psicoterapia de R$ 200 grava `valorCentavos` 20000.
  - Na avaliação, o comparecimento grava `null` e a falta sem aviso grava 16000.
  - "Voltar para Agendada" grava `null`.
  - Reajuste (Review Focus 2): marcar com valor 20000, mudar o paciente para 22000 e marcar outra sessão → a primeira continua 20000.
  - Sessão paga → `marcarSituacao(…, 'falta_com_aviso')` rejeita com a mensagem exata, e a sessão continua `compareceu` com o valor (Review Focus 1).
  - Sessão paga → `falta_sem_aviso` é aceito.
  - `registrarPagamento` de sessões soma os valores. Sessão de outro paciente, ou sem valor, rejeita.
  - `registrarPagamento` de mês usa o total. Mês já pago rejeita.
  - `registrarPagamento` de avaliação acima do que falta rejeita com a mensagem exata.
  - `agendarReposicao` cria a nova sessão, e a original continua `falta_sem_aviso` com `remarcadaPara`. Em psicoterapia, rejeita.
  - `mudarTipo` com uma observação numa sessão futura agendada → depois da mudança, a mesma sessão (mesmo id) tem o tipo novo e a observação. A sessão de hoje que já passou não muda.
  - `mudarTipo` repetido com o mesmo tipo concilia sessões que ficaram com o tipo antigo.
  - `criarPaciente` em avaliação usa o valor padrão das configurações.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Atualize o hook `useMudarTipo` para passar `new Date()`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "Adiciona serviços de cobrança e guarda o valor de cada sessão"`

---

### Task 5: Valores da avaliação e valor padrão nas configurações

**Files:**
- Create: `src/telas/pacientes/ValoresDaAvaliacao.tsx`
- Modify: `src/telas/pacientes/SecaoAvaliacao.tsx`, `src/telas/mais/FormularioConfiguracoes.tsx` (+ testes)

**Interfaces:**
- Consumes: `valorFinalDaAvaliacao`, `ROTULO_DESCONTO`, `formatarReais`, `lerReais`, `useSalvarAvaliacao`, `useSalvarConfiguracoes`.
- **Configurações:** um grupo novo `<fieldset>` com a legenda "Cobrança" e o campo "Valor padrão da avaliação" (R$; aceita 0; máximo R$ 100.000,00), salvo junto com o resto.
- **Ficha → Avaliação:**
  - "Valor previsto" (R$);
  - "Desconto" (`GrupoDeOpcoes`: Sem desconto / Em reais / Em porcentagem) e o campo do valor do desconto, que aparece quando há desconto;
  - a linha **"Valor final: R$ 1.530,00"** atualizando enquanto digita;
  - o botão "Salvar valores";
  - validação: porcentagem de 0 a 100 ("Use uma porcentagem de 0 a 100."); desconto em reais maior que o previsto → "O desconto passa do valor previsto."

- [ ] **Step 1: Escrever os testes que falham**
  - Configurações com 1800 → `valorAvaliacaoPadraoCentavos` 180000.
  - Ficha do Pedro (semente):
    - mostra "Valor final: R$ 1.620,00" (1800 − 10%);
    - mudar para 15% mostra "R$ 1.530,00" e, depois de salvar, persiste;
    - 120% mostra o erro e não salva;
    - desconto em reais de 2000 mostra o erro.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "Adiciona valores da avaliação e valor padrão nas configurações"`

---

### Task 6: Cobrança no painel da sessão e reposição

**Files:**
- Create: `src/componentes/FormularioPagamento.tsx`, `src/dados/useCobranca.ts`, `src/telas/agenda/CobrancaDaSessao.tsx`, `src/telas/agenda/ReposicaoDaSessao.tsx`
- Modify: `src/telas/agenda/PainelSessao.tsx` (+ testes)

**Interfaces:**
- Produces:
  - `useCobranca.ts`:
    - `usePagamentosDoPaciente(pacienteId)`, chave `['pagamentos', pacienteId]`;
    - `usePendencias(pacienteId)`, que combina ficha, sessões do paciente e pagamentos via `pendenciasDoPaciente`;
    - `useRegistrarPagamento()`, `useRemoverPagamento()` e `useAgendarReposicao()`, que invalidam `['pagamentos']`, `['sessoes']`, `['ficha']`, `['pacientes']` e `['aReceber']` em `onSettled`.
  - `<FormularioPagamento valorCentavos | valorEditavel aoEnviar aoCancelar />`:
    - "Data" (padrão hoje);
    - "Forma" (`GrupoDeOpcoes` com os 4 rótulos, padrão Pix);
    - "Observação";
    - "Valor": texto fixo `R$ …` ou campo editável (avaliação);
    - botões "Confirmar pagamento" e "Cancelar".
- **Painel (abaixo da situação),** texto exato por caso:
  - psicoterapia por sessão ou falta da avaliação, com valor e sem pagamento → **"Pendente · R$ 180,00"** e o botão **"Registrar pagamento"**, que abre o formulário com o valor fixo;
  - paga → **"Pago em 03/11 · Pix"**;
  - psicoterapia mensal com valor → **"Entra na mensalidade de novembro de 2026"**;
  - comparecimento na avaliação → **"Incluída no pacote da avaliação"**;
  - sem valor → nada.
- Erro de `ErroCobranca` ao mudar situação: aparece no painel com o texto exato (`Aviso tipo="erro"`).
- **Reposição:** avaliação com `falta_sem_aviso` e sem `remarcadaPara` → bloco "Agendar reposição" (data, hora, botão "Agendar reposição"). Com `remarcadaPara` → "Reposição em {diaPorExtenso}, {hora}".

- [ ] **Step 1: Escrever os testes que falham** (semente, relógio 2026-11-02 12:00)
  - Abrir a sessão paga da Maria em outubro (navegar até a semana) → "Pago em …".
  - A outra sessão → "Pendente · R$ 180,00" → "Registrar pagamento" com Pix → passa a "Pago em 02/11 · Pix".
  - A sessão da Ana em outubro → "Entra na mensalidade de outubro de 2026".
  - A sessão feita do Pedro → "Incluída no pacote da avaliação".
  - Na sessão paga, tocar "Faltou com aviso" → aparece a mensagem do Review Focus 1, e o chip continua "Compareceu".
  - Pedro 04/11: "Faltou sem aviso" → "Pendente · R$ 160,00" → "Agendar reposição" para 06/11 10:00 → "Reposição em sexta-feira, 06/11, 10:00", e a sexta mostra a nova sessão.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "Mostra a cobrança no painel da sessão e permite reposição na avaliação"`

---

### Task 7: Seção Financeiro na ficha

**Files:**
- Create: `src/telas/pacientes/SecaoFinanceiro.tsx`
- Modify: `src/telas/pacientes/FichaPaciente.tsx` (+ teste `SecaoFinanceiro.test.tsx`)

**Interfaces:**
- Consumes: `usePendencias`, `usePagamentosDoPaciente`, `useRegistrarPagamento`, `useRemoverPagamento`, `FormularioPagamento`, `DialogoConfirmacao`, `mesPorExtenso`, `ROTULO_FORMA`.
- A seção recolhível "Financeiro" fica depois de "Cobrança". Conteúdo:
  - **"Em aberto: R$ X"**, ou "Nada em aberto.".
  - **Sessões em aberto:** lista com caixas de marcar (data, tipo, valor) e o botão "Registrar pagamento das marcadas", que soma as marcadas.
  - **Meses (mensal):** uma linha por mês, `"{mês por extenso} · {n} sessões · R$ X"`, com o chip `Pago` / `Devendo` / `Em andamento` (texto e ícone). Nos meses não pagos, o botão "Registrar pagamento do mês". No pago com diferença, `Aviso`: **"O valor de {mês} mudou depois do pagamento: diferença de R$ X."**
  - **Pacote da avaliação:** "Valor final R$ … · Pago R$ … · Falta R$ …" e "Registrar parcela", com o valor editável (padrão = falta).
  - **Pagamentos:** histórico do mais novo para o mais antigo (`"03/11/2026 · Pix · R$ 180,00 · {do que se trata}"`) e "Remover" com confirmação, cujo texto avisa que as sessões voltam a ficar em aberto.

- [ ] **Step 1: Escrever os testes que falham** (semente)
  - **Ana:**
    - "Em aberto: R$ 800,00", outubro `Devendo` e novembro `Em andamento` (se houver sessão com valor);
    - "Registrar pagamento do mês" de outubro → outubro `Pago`, e o em aberto cai;
    - depois, marcar uma sessão de outubro como "Faltou com aviso" na agenda e voltar → aviso de diferença de −R$ 200,00 (Review Focus 3).
  - **Maria:** marcar a sessão aberta e registrar → "Nada em aberto.".
  - **Pedro:** "Falta R$ 810,00". Registrar uma parcela de 900 → erro de valor acima. Uma parcela de 810 → "Falta R$ 0,00".
  - **Remover pagamento:** pede confirmação. Ao confirmar, a sessão volta a "em aberto".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "Adiciona a parte financeira da ficha do paciente"`

---

### Task 8: Aba Financeiro — a receber e pagamentos

**Files:**
- Create: `src/telas/financeiro/ListaAReceber.tsx`, `src/telas/financeiro/ListaPagamentos.tsx`
- Modify: `src/telas/financeiro/TelaFinanceiro.tsx`, `src/dados/useCobranca.ts` (+ teste `TelaFinanceiro.test.tsx`)

**Interfaces:**
- Produces: `useAReceber()`, chave `['aReceber']`. Combina `listarPacientes`, `listarSessoesCobradas`, `listarPagamentos()`, as avaliações das fichas dos pacientes em avaliação e `hojeISO()`, via `pendenciasDoPaciente` + `resumoAReceber`. Também `usePagamentosDoMes(mes)`, com `listarPagamentos({ de: mes, ate: último dia })`.
- **Tela "Financeiro":**
  - **"A receber":**
    - total geral;
    - lista por paciente: nome, valor e "desde {dd/mm/aaaa}", com link para a ficha (`/pacientes/:id`, que abre a seção Financeiro);
    - vazio → "Ninguém está devendo.".
  - **"Pagamentos":**
    - seletor de mês com setas "Mês anterior" / "Próximo mês" e o rótulo `mesPorExtenso`;
    - lista (data, paciente, forma, valor);
    - **"Recebido no mês: R$ X"**.
  - Rodapé discreto: "Despesas, recibos e relatórios chegam numa próxima etapa."

- [ ] **Step 1: Escrever os testes que falham** (semente, relógio 2026-11-02)
  - "A receber" lista Ana (R$ 800,00, desde 01/10/2026), Maria (R$ 180,00) e Pedro (R$ 810,00). Total R$ 1.790,00, em ordem de "desde".
  - Pagamentos de outubro mostram o da Maria e o do Pedro, com "Recebido no mês" igual à soma.
  - Registrar pagamento na ficha da Maria → ao voltar à aba, a Maria sai da lista.
  - O vazio mostra "Ninguém está devendo.".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** A aba "Relatórios" continua em construção.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "Adiciona a aba Financeiro com a receber e pagamentos"`

---

### Task 9: Teste de ponta a ponta e documentação

**Files:**
- Create: `e2e/cobranca.spec.ts`
- Modify: `docs/instalacao.md` (nova migração), `README.md`, `docs/superpowers/pendencias-etapas-1-e-2.md` (marcar o que foi resolvido)

- [ ] **Step 1: Escrever o E2E**, com relógio 2026-11-02 e os projetos celular e notebook:
  1. aba Financeiro → "A receber" mostra Ana, Maria e Pedro;
  2. abrir a ficha da Ana → registrar o mês de outubro;
  3. voltar ao Financeiro → a Ana sai da lista, e "Pagamentos" de novembro mostra o pagamento;
  4. agenda → sessão da Maria em aberto → "Registrar pagamento" → "Pago em 02/11 · Pix";
  5. nenhum erro no console.
- [ ] **Step 2: Rodar:** `npm run e2e` → passa nos dois projetos. O E2E das Etapas 1 e 2 continua passando.
- [ ] **Step 3: Documentação:**
  - no guia, um passo novo, "Atualizar o banco": colar `supabase/migrations/20261101120000_cobranca.sql` no SQL Editor depois da base, com a ordem dos arquivos;
  - o README menciona a aba Financeiro;
  - nas pendências, marcar como resolvidos: mudarTipo conciliador, revoke de `anon` por padrão, paginação, falta sem aviso com reposição e pino de colunas.
- [ ] **Step 4: Verificação final:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → tudo passa.
- [ ] **Step 5: Commit:** `git commit -m "Adiciona teste de ponta a ponta da cobrança e atualiza o guia"`
