# Etapa 4 — Registro da sessão com o Claude: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois da sessão, a psicóloga dita o que aconteceu, toca em "Resumir" e recebe os quatro campos do registro organizados pelo Claude. O Claude nunca recebe nomes. Ela revisa, ajusta e salva. O texto ditado nunca se perde, e o registro também pode ser escrito sem o Claude.

**Architecture:**
- **Dados:** o registro fica numa tabela própria, `registros_sessao` (1 para 1 com `sessoes`), e não em colunas de `sessoes`. Assim, texto clínico longo não viaja em cada consulta da agenda. Essa é a diferença em relação à spec §12.2.
- **Regras puras** (`src/regras/registro.ts`): trocar nomes por marcadores e depois recolocá-los.
- **Resumo:** uma Edge Function do Supabase (`resumir-sessao`, Deno) chama a API do Claude com o SDK oficial e saída estruturada (JSON schema). A chave fica só nos segredos do Supabase.
- **No aplicativo:** um `Resumidor` (interface com versão Supabase e versão de demonstração) entra pelos `Provedores`, como o `Repositorio`. A tela nova `TelaRegistro` guarda o rascunho no aparelho.

**Tech Stack:** a mesma do projeto, mais `@anthropic-ai/sdk@1.3.0`. Na função, via `npm:@anthropic-ai/sdk@1.3.0`. No projeto, como devDependency, para os tipos e os testes. Versão fixada, publicada em 23/10/2026.

**Spec:** `docs/superpowers/specs/2026-10-21-sistema-consultorio-design.md`: §7 inteiro, §10 (linha "Claude"), §11 (custo), §12.1 (Edge Function `resumir-sessao`), §12.4 (sem internet / falha do Claude).

**Fora deste plano:** documentos (Etapa 5); despesas, recibos e relatórios (Etapa 6); cópia de segurança (que um dia incluirá os registros), duas etapas e bloqueio automático (Etapa 7).

## Global Constraints

- Todas as restrições das Etapas 1–3 continuam valendo. Os itens abaixo mudam ou se somam a elas.
- **Exceção ao "nada de paciente em Web Storage":** só o rascunho do registro, que a spec §7 exige que fique no aparelho.
  - Ele fica em `localStorage`, na chave `consultorio:rascunho-registro:<sessaoId>`, e guarda só `{ textoFalado, campos, atualizadoEm }`: nada de nome, nem de id de paciente.
  - É apagado ao salvar o registro e, todos de uma vez, ao tocar em "Sair".
  - Toda leitura e escrita fica em `try/catch`. Sem armazenamento, a tela continua funcionando, só sem rascunho.
- **Rótulos exatos dos quatro campos:** `Como chegou`, `O que foi trabalhado`, `Observações`, `Próximos passos`.
- **Outros rótulos exatos:**
  - área do texto ditado: `O que aconteceu na sessão`;
  - botões: `Ditar`, `Parar de ditar`, `Resumir`, `Resumindo…`, `Salvar registro`, `Salvando…`, `Tentar de novo`.
- **Marcadores de nomes:** paciente `[P]`; responsáveis `[R1]`, `[R2]`… na ordem de `ficha.responsaveis` (o principal primeiro).
- **Modelo:** padrão `claude-opus-5-5`, trocável pela variável `CLAUDE_MODELO` nos segredos do Supabase.
- **Parâmetros da chamada:**
  - `output_config.effort` vale `"medium"`;
  - com esse modelo (`claude-opus-5-5`), a chamada liga `fallbacks: "default"`, beta `server-side-fallback-2026-07-01`;
  - com outro modelo, os fallbacks ficam desligados.
- **Limite do texto:** 20.000 caracteres. Uma sessão de 50 minutos ditada dá cerca de 5.000.
- **Nada é salvo sem a revisão dela:** o resumo só preenche os campos da tela. Só "Salvar registro" grava.

## Review Focus

1. **Nome dentro de outra palavra ou com outra grafia:**
   - "Ana" não pode trocar o começo de "Anaís" nem o meio de "Mariana";
   - "joão", "JOÃO" e "Joao" (sem acento) viram `[P]` para o paciente João;
   - "Ana Clara" vira um só `[P]`, não `[P] [P]`.

   Teste na Task 2.
2. **O texto ditado já contém um "[P]" literal, ou o Claude devolve um marcador que não existe (`[R9]`):** a troca de volta não pode quebrar nem inventar nomes. O marcador desconhecido fica como está. Teste na Task 2.
3. **Sem internet, ou o Claude falha ou recusa:** o texto ditado continua na tela e no rascunho, aparece a mensagem certa com "Tentar de novo", e nada é salvo. Teste na Task 5.
4. **Ela fecha o aplicativo no meio do ditado e volta depois:** a tela abre com o rascunho, mesmo que um registro já tenha sido salvo antes. O rascunho vence, porque é mais novo. Teste na Task 5.
5. **Ela toca em "Resumir" depois de já ter escrito nos campos:** o resumo não apaga o que ela escreveu sem perguntar. Antes de substituir, aparece uma confirmação. Teste na Task 5.

---

## Estrutura de arquivos

```
supabase/migrations/20261115120000_registro.sql   # tabela registros_sessao + RLS
supabase/tests/registro.test.ts                    # RLS, 1 por sessão, cascata, pino das colunas
supabase/functions/resumir-sessao/index.ts         # Edge Function (arquivo único, para colar no painel)
supabase/functions/resumir-sessao/index.test.ts    # testes com cliente falso (Vitest)
src/dominio/tipos.ts                               # RegistroSessao, CamposRegistro (modificar)
src/dados/repositorio.ts, memoria.ts, supabase.ts, mapeamento.ts, repositorio.contrato.ts, semente-demo.ts  (modificar)
src/regras/registro.ts (+ .test.ts)                # anonimizar / restaurar / registroVazio
src/dados/resumidor.ts (+ .test.ts)                # interface Resumidor, ErroResumo, versão Supabase e demo
src/dados/contexto-resumidor.tsx                   # ResumidorProvider / useResumidor
src/dados/rascunhos.ts (+ .test.ts)                # rascunho no aparelho
src/dados/useRegistro.ts (+ .test.tsx)             # consultas e mutações do registro
src/telas/registro/TelaRegistro.tsx (+ .test.tsx)  # a tela
src/telas/registro/BotaoDitar.tsx (+ .test.tsx)    # ditado pelo navegador (quando existir)
src/Provedores.tsx, src/main.tsx, src/App.tsx      # resumidor + rota (modificar)
src/telas/agenda/PainelSessao.tsx, src/telas/pacientes/SecaoSessoes.tsx  # atalhos (modificar)
e2e/registro.spec.ts
docs/instalacao.md, README.md, docs/superpowers/pendencias-etapas-1-e-2.md
```

---

### Task 1: Banco e repositório do registro

**Files:**
- Create: `supabase/migrations/20261115120000_registro.sql`, `supabase/tests/registro.test.ts`
- Modify: `src/dominio/tipos.ts`, `src/dados/repositorio.ts`, `src/dados/memoria.ts`, `src/dados/supabase.ts`, `src/dados/mapeamento.ts`, `src/dados/repositorio.contrato.ts`, `src/dados/semente-demo.ts` (+ seus testes); `supabase/tests/banco.ts` (rodar as três migrações em ordem)

**Interfaces:**
- Produces:
  - `interface CamposRegistro { comoChegou: string; trabalhado: string; observacoes: string; proximosPassos: string }`;
  - `interface RegistroSessao extends CamposRegistro { sessaoId: Id; textoFalado: string; atualizadoEm: string /* ISO UTC */ }`;
  - métodos novos do `Repositorio`:
    - `obterSessao(id: Id): Promise<SessaoComPaciente | null>`;
    - `obterRegistro(sessaoId: Id): Promise<RegistroSessao | null>`;
    - `salvarRegistro(sessaoId: Id, dados: Omit<RegistroSessao, 'sessaoId' | 'atualizadoEm'>): Promise<RegistroSessao>` (insere ou substitui; rejeita sessão inexistente);
    - `listarSessoesComRegistro(pacienteId: Id): Promise<Id[]>`.

- [ ] **Step 1: Migração.** Tabela `registros_sessao`:
  - `sessao_id uuid primary key references sessoes(id) on delete cascade`;
  - `dono uuid not null default auth.uid()`;
  - `texto_falado`, `como_chegou`, `trabalhado`, `observacoes`, `proximos_passos`: `text not null default ''`;
  - `atualizado_em timestamptz not null default now()`.

  Acesso: RLS `dono = auth.uid()` em todas as operações, `grant select, insert, update, delete` para `authenticated`, nada para `anon`, e a linha de `alter default privileges … revoke all on tables from anon` já usada na migração da cobrança.
- [ ] **Step 2: Testes PGlite que falham** em `supabase/tests/registro.test.ts`:
  - `outra conta não lê nem grava o registro`;
  - `anon não acessa registros_sessao`;
  - `um registro por sessão` (o segundo insert do mesmo `sessao_id` dá conflito);
  - `apagar a sessão apaga o registro`;
  - `pino das colunas`: as colunas de `mapeamento.ts` existem na tabela migrada (mesmo padrão do pino da Etapa 3).
- [ ] **Step 3: Tipos, mapeamento e repositório.** Implementar nos dois adaptadores. No Supabase, `salvarRegistro` usa `upsert` em `sessao_id` e `obterSessao` usa o mesmo embed de `listarSessoes`. Casos novos na suíte de contrato:
  - `salvarRegistro substitui o anterior e atualiza atualizadoEm`;
  - `obterRegistro de sessão sem registro devolve null`;
  - `salvarRegistro de sessão inexistente rejeita`;
  - `listarSessoesComRegistro só devolve as do paciente`;
  - `obterSessao devolve pacienteNome e null para id inexistente`.
- [ ] **Step 4: Semente de demonstração:** um registro da sessão de Maria Luísa em 22/10/2026, com os quatro campos e o texto falado preenchidos com texto fictício curto.
- [ ] **Step 5: Verificar:** `npm run typecheck && npm run lint && npm test` → tudo passa.
- [ ] **Step 6: Commit:** `Adiciona o registro da sessão no banco e no repositório`

---

### Task 2: Trocar os nomes por marcadores e de volta

**Files:** Create `src/regras/registro.ts`, `src/regras/registro.test.ts`

**Interfaces:**
- Produces:
  - `interface Pessoas { paciente: string; responsaveis: string[] }`;
  - `interface TextoAnonimo { texto: string; mapa: Record<string, string> }` (marcador → nome para devolver);
  - `anonimizar(texto: string, pessoas: Pessoas): TextoAnonimo`;
  - `restaurar(campos: CamposRegistro, mapa: Record<string, string>): CamposRegistro`;
  - `registroVazio(c: CamposRegistro): boolean`.

Regras:
- **Variantes de cada pessoa:** o nome completo, cada sequência contínua de palavras do nome e cada palavra com 3 letras ou mais. Tudo é comparado sem diferenciar maiúsculas e acentos. A variante mais longa é trocada primeiro.
- **Limites de palavra:** com `\p{L}` e a flag `u`. Não use `\b`, que não entende acentos.
- **Variante compartilhada:** se uma variante pertence a duas pessoas (sobrenome em comum, por exemplo "Souza"), ela é trocada pelo marcador `[F]` (família), que volta como "a família".
- **Volta dos nomes:** `[P]` volta como o primeiro nome do paciente; `[Rn]` volta como o primeiro nome do responsável n.
- **Marcador já presente no texto ditado:** o texto que já contém `[P]`, `[R1]` ou `[F]` literal tem esses colchetes trocados por parênteses antes do resto, para não confundir a volta.
- **Marcador desconhecido** devolvido pelo Claude: fica como está.

- [ ] **Step 1: Testes que falham**, com `pessoas = { paciente: 'Ana Clara Souza', responsaveis: ['Marcos Souza', 'Júlia Ramos'] }`:
  - `troca o nome completo por um só marcador`: "Ana Clara Souza chegou" → "[P] chegou";
  - `troca o primeiro nome sem acento e em maiúsculas`: com o paciente "João Pedro", "JOAO e joão" → "[P] e [P]";
  - `não troca dentro de outra palavra`: "Mariana e Anaís" fica igual;
  - `sobrenome em comum vira [F]`: "os Souza vieram" → "os [F] vieram";
  - `responsáveis em ordem`: "Marcos e Júlia" → "[R1] e [R2]";
  - `colchetes já existentes viram parênteses`: "[P]" → "(P)";
  - `restaura pelo primeiro nome e mantém o desconhecido`: `restaurar({comoChegou:'[P] veio com [R1]', trabalhado:'[R9]', observacoes:'', proximosPassos:'[F]'}, mapa)` → `'Ana veio com Marcos'`, `'[R9]'`, `''`, `'a família'`;
  - `registroVazio`: verdadeiro só com os quatro campos em branco ou só com espaços.
- [ ] **Step 2: Rodar:** `npm test -- src/regras/registro.test.ts` → falha.
- [ ] **Step 3: Implementar** `src/regras/registro.ts`.
- [ ] **Step 4: Rodar:** `npm test -- src/regras/registro.test.ts` → passa.
- [ ] **Step 5: Commit:** `Troca os nomes por marcadores antes de enviar ao Claude`

---

### Task 3: Edge Function `resumir-sessao`

**Files:**
- Create: `supabase/functions/resumir-sessao/index.ts`, `supabase/functions/resumir-sessao/index.test.ts`
- Modify: `package.json` (devDependency `@anthropic-ai/sdk` exatamente `1.3.0`), `vitest.config.ts`, `tsconfig.node.json` e `eslint.config.js`, conforme precisar

**Interfaces:**
- Produces:
  - `export async function tratar(req: Request, deps: { cliente: Pick<Anthropic, 'beta'> | null; modelo: string }): Promise<Response>`;
  - **POST** com corpo `{ texto: string }` → 200 `{ comoChegou, trabalhado, observacoes, proximosPassos }`;
  - **erro** → `{ erro: Codigo }` com o status ao lado de cada código: `'texto_vazio'` 400 | `'texto_longo'` 413 | `'sem_chave'` 500 | `'recusa'` 422 | `'falha_claude'` 502 | `'metodo'` 405;
  - **OPTIONS** → 204 com cabeçalhos CORS (`Access-Control-Allow-Origin: *`; `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`). Todas as respostas levam o `Allow-Origin`.

Como o arquivo é organizado:
- **Arquivo único**, porque ela cola o código no editor de funções do painel do Supabase.
- **Import do SDK:** `import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'`. O `vitest.config.ts` ganha `resolve.alias` desse especificador para `@anthropic-ai/sdk`.
- **No fim do arquivo:** `if (typeof Deno !== 'undefined') Deno.serve(...)`, que lê `ANTHROPIC_API_KEY` (sem ela, `cliente: null`) e `CLAUDE_MODELO` (padrão `claude-opus-5-5`). Declarar um tipo mínimo de `Deno` no próprio arquivo.
- **A chamada:**
  - `cliente.beta.messages.create({ model, max_tokens: 16000, system: PROMPT, messages: [{ role: 'user', content: texto }], output_config: { effort: 'medium', format: { type: 'json_schema', schema } }, ...fallbacks })`;
  - o schema tem `como_chegou`, `trabalhado`, `observacoes` e `proximos_passos` como string, todos em `required`, com `additionalProperties: false`;
  - `fallbacks` é `{ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }` só quando o modelo é `claude-opus-5-5`;
  - verificar `stop_reason`: `'refusal'` → `recusa`; `'max_tokens'` → `falha_claude`;
  - fazer o `JSON.parse` do bloco de texto; parse inválido → `falha_claude`;
  - erro do SDK (`Anthropic.APIError` ou de conexão) → `falha_claude`, sem repassar a mensagem do SDK;
  - não registrar o texto em log;
  - só a dona chama a função porque a verificação de JWT do Supabase está ligada (o padrão); o guia manda deixá-la ligada.
- **`PROMPT`, em pt-BR, texto exato:**

```
Você organiza o registro de uma sessão de psicologia infantojuvenil, a partir do relato ditado pela psicóloga depois da sessão.
Os nomes foram trocados por marcadores: [P] é a criança ou o adolescente atendido, [R1], [R2]… são os responsáveis e [F] é a família. Use os marcadores exatamente como estão.
Escreva em português do Brasil, em terceira pessoa, com frases curtas e linguagem técnica e respeitosa.
Use somente o que está no relato. Não invente, não deduza diagnósticos e não acrescente interpretações que a psicóloga não fez. Se o relato não falar de um dos campos, deixe esse campo vazio.
Campos:
- como_chegou: como a criança chegou à sessão (humor, disposição, o que trouxe, quem acompanhou).
- trabalhado: o que foi trabalhado na sessão (atividades, temas, técnicas, recursos).
- observacoes: observações clínicas relevantes que a psicóloga relatou.
- proximos_passos: o que fica para as próximas sessões ou para combinar com a família ou a escola.
```

- [ ] **Step 1: Testes que falham** em `index.test.ts`, com um cliente falso cujo `beta.messages.create` é um `vi.fn()`:
  - `OPTIONS devolve 204 com CORS`;
  - `GET devolve 405`;
  - `texto vazio ou só espaços devolve 400 texto_vazio sem chamar o Claude`;
  - `texto com 20001 caracteres devolve 413`;
  - `sem chave devolve 500 sem_chave`;
  - `devolve os quatro campos em camelCase`;
  - `envia o modelo, effort medium, o schema e fallbacks default com claude-opus-5-5`;
  - `com CLAUDE_MODELO claude-haiku-5-5 não envia fallbacks`;
  - `stop_reason refusal devolve 422 recusa`;
  - `JSON inválido devolve 502 falha_claude`;
  - `erro do SDK devolve 502 falha_claude`.
- [ ] **Step 2: Rodar:** `npm test -- supabase/functions` → falha.
- [ ] **Step 3: Implementar** `index.ts` e incluir `supabase/functions/**/*.test.ts` no projeto "unidade" do Vitest.
- [ ] **Step 4: Rodar:** `npm run typecheck && npm run lint && npm test` → passa.
- [ ] **Step 5: Commit:** `Adiciona a função que resume a sessão com o Claude`

---

### Task 4: Resumidor, rascunho e consultas

**Files:**
- Create:
  - `src/dados/resumidor.ts` (+ `.test.ts`);
  - `src/dados/contexto-resumidor.tsx`;
  - `src/dados/rascunhos.ts` (+ `.test.ts`);
  - `src/dados/useRegistro.ts` (+ `.test.tsx`).
- Modify: `src/Provedores.tsx` (prop `resumidor`), `src/main.tsx`, o ajudante de testes `renderComRotas`, `src/dados/autenticacao.ts` ou o "Sair" da tela Mais (apagar rascunhos ao sair).

**Interfaces:**
- Consumes: `anonimizar` e `restaurar` (Task 2); o contrato HTTP da Task 3; `obterRegistro` e `salvarRegistro` (Task 1).
- Produces:
  - `interface Resumidor { resumir(textoAnonimo: string): Promise<CamposRegistro> }`;
  - `class ErroResumo extends Error { codigo: 'sem_internet' | 'texto_longo' | 'sem_chave' | 'recusa' | 'falha' }`;
  - `criarResumidorSupabase(cliente: SupabaseClient): Resumidor` (`cliente.functions.invoke('resumir-sessao', { body: { texto } })`; mapeia os códigos da Task 3; erro de rede ou `navigator.onLine === false` → `sem_internet`; o resto → `falha`);
  - `resumidorDemonstracao: Resumidor` (devolve, depois de ~300 ms, campos fictícios que começam com `(demonstração)` e usam `[P]`);
  - `ResumidorProvider` / `useResumidor()`;
  - `MENSAGEM_DO_RESUMO: Record<ErroResumo['codigo'], string>`, com estas mensagens exatas:
    - `sem_internet`: "Sem internet agora. O texto ficou guardado neste aparelho; tente de novo quando a conexão voltar."
    - `texto_longo`: "O texto está longo demais para resumir de uma vez (máximo de 20.000 caracteres)."
    - `sem_chave`: "O resumo com o Claude ainda não foi ligado. Veja o passo 1.7 do guia de instalação."
    - `recusa`: "O Claude não quis resumir este texto. Escreva o registro à mão ou ajuste o texto e tente de novo."
    - `falha`: "O Claude não conseguiu resumir agora. O texto continua aqui; tente de novo."
  - `rascunhos`:
    - `lerRascunho(sessaoId): Rascunho | null`;
    - `guardarRascunho(sessaoId, r: Omit<Rascunho, 'atualizadoEm'>): void`;
    - `apagarRascunho(sessaoId): void`;
    - `apagarTodosOsRascunhos(): void`;
    - `interface Rascunho { textoFalado: string; campos: CamposRegistro; atualizadoEm: string }`.
  - hooks:
    - `useSessao(id)`;
    - `useRegistro(sessaoId)` (chave `['registro', sessaoId]`);
    - `useSalvarRegistro()` (invalida `['registro', id]` e `['sessoesComRegistro', pacienteId]` em `onSettled`);
    - `useSessoesComRegistro(pacienteId)`;
    - `useResumir()`: mutação que recebe `{ texto, pessoas }`, faz `anonimizar` → `resumidor.resumir` → `restaurar` e devolve `CamposRegistro`.

- [ ] **Step 1: Testes que falham:**
  - `resumidor.test.ts`, com o `functions.invoke` falso, um teste por código de erro:
    - `200 vira CamposRegistro`;
    - `413 vira texto_longo`;
    - `500 sem_chave vira sem_chave`;
    - `422 vira recusa`;
    - `erro de rede vira sem_internet`;
    - `outro erro vira falha`.
  - `rascunhos.test.ts`:
    - `guarda e lê`;
    - `apagar remove só aquele`;
    - `apagarTodos remove só as chaves consultorio:rascunho-registro:`;
    - `localStorage que lança não quebra (ler devolve null)`;
    - `JSON corrompido devolve null`.
  - `useRegistro.test.tsx`:
    - `useResumir nunca envia o nome ao resumidor` (o resumidor falso recebe o texto, e o teste confere que nem "Ana" nem "Marcos" aparecem nele);
    - `os nomes voltam no resultado`.
  - teste do Sair: `sair apaga os rascunhos`.
- [ ] **Step 2: Rodar** → falha.
- [ ] **Step 3: Implementar.** Ligações:
  - `main.tsx` escolhe `criarResumidorSupabase(cliente)` quando há cliente, senão `resumidorDemonstracao`;
  - `Provedores` exige `resumidor`;
  - nos testes, o padrão do ajudante é um resumidor falso.
- [ ] **Step 4: Rodar:** `npm run typecheck && npm run lint && npm test` → passa.
- [ ] **Step 5: Commit:** `Liga o aplicativo ao resumo e guarda o rascunho no aparelho`

---

### Task 5: Tela do registro e ditado

**Files:**
- Create: `src/telas/registro/TelaRegistro.tsx`, `src/telas/registro/BotaoDitar.tsx` (+ testes de cada um)
- Modify: `src/App.tsx` (rota `agenda/sessoes/:id/registro`, protegida como as outras)

**Interfaces:**
- Consumes: os hooks e o `rascunhos` da Task 4; `registroVazio` (Task 2); `useFicha(pacienteId)` (já existe), para os nomes dos responsáveis.
- Produces:
  - a rota `/agenda/sessoes/:id/registro`;
  - `BotaoDitar({ aoReconhecer: (texto: string) => void })`, que não renderiza nada quando não existe `window.SpeechRecognition` nem `window.webkitSpeechRecognition`.

**O que a tela mostra, de cima para baixo:**
1. Título `Registro da sessão`, o nome do paciente e a data e hora (Nunito Sans).
2. A área `O que aconteceu na sessão`, com `BotaoDitar` (`Ditar` / `Parar de ditar`; `lang = 'pt-BR'`, `continuous = true`, só os resultados finais são acrescentados ao fim do texto, separados por espaço) e a dica "Você também pode usar o microfone do teclado."
3. O botão `Resumir`: fica desabilitado com o texto vazio e mostra `Resumindo…` enquanto trabalha. Os erros aparecem num `Aviso tipo="erro"` com a mensagem de `MENSAGEM_DO_RESUMO`, mais o botão `Tentar de novo`.
4. Os quatro campos, sempre editáveis, inclusive sem usar o Claude.
5. O botão `Salvar registro`:
   - grava `textoFalado` + campos e apaga o rascunho;
   - mostra o `Aviso tipo="sucesso"` "Registro salvo.";
   - é recusado com "Escreva o registro ou resuma o texto antes de salvar." quando o texto e os campos estão todos vazios.
6. O link `Voltar para a agenda`.

**Comportamento:**
- **Abertura da tela:** se há rascunho, ele é usado, e aparece o aviso "Rascunho recuperado deste aparelho." Senão, entra o registro salvo; senão, tudo vazio.
- **Rascunho:** é guardado a cada mudança, com espera de 500 ms.
- **Resumir com campos já preenchidos:** abre o `DialogoConfirmacao` "Substituir o que está nos campos pelo resumo?". "Cancelar" mantém tudo como está.
- **Caso de exceção:** sessão inexistente → `FalhaAoCarregar` com "Sessão não encontrada."

- [ ] **Step 1: Testes que falham** (`TelaRegistro.test.tsx`, com repositório em memória e resumidor falso):
  - `resume e preenche os quatro campos com os nomes de volta`;
  - `salva, mostra Registro salvo. e apaga o rascunho`;
  - `abre com o rascunho e o aviso de recuperação quando há rascunho`;
  - `sem internet: mostra a mensagem exata, mantém o texto e não salva`;
  - `recusa: mostra a mensagem exata`;
  - `Tentar de novo chama o resumidor outra vez`;
  - `com campos preenchidos, Resumir pede confirmação e Cancelar não troca nada`;
  - `salvar tudo vazio mostra a mensagem e não grava`;
  - `escrever direto nos campos e salvar funciona sem resumir`;
  - `sessão inexistente mostra Sessão não encontrada.`

  E `BotaoDitar.test.tsx`:
  - `sem SpeechRecognition não aparece`;
  - `com o falso, Ditar começa em pt-BR e acrescenta só resultados finais`;
  - `Parar de ditar encerra`.
- [ ] **Step 2: Rodar** → falha.
- [ ] **Step 3: Implementar.** Tamanhos e acessibilidade:
  - toque com no mínimo 44 px;
  - `aria-live` nos avisos, como no resto do projeto;
  - no celular, uma coluna; a partir de 768 px, o texto ditado e os campos lado a lado.
- [ ] **Step 4: Rodar:** `npm run typecheck && npm run lint && npm test` → passa.
- [ ] **Step 5: Commit:** `Adiciona a tela do registro da sessão com ditado e resumo`

---

### Task 6: Caminhos até o registro

**Files:** Modify `src/telas/agenda/PainelSessao.tsx`, `src/telas/pacientes/SecaoSessoes.tsx` (+ seus testes)

**Interfaces:** Consumes `useSessoesComRegistro` e `useRegistro` (Task 4) e a rota da Task 5.

- [ ] **Step 1: Testes que falham:**
  - `PainelSessao.test.tsx`:
    - `sessão compareceu mostra Escrever registro`;
    - `sessão com registro mostra Ver registro`;
    - `sessão agendada, cancelada ou remarcada não mostra o atalho`;
    - `o atalho leva a /agenda/sessoes/:id/registro`;
    - a falta sem aviso também mostra o atalho (ela pode querer anotar o contato com a família).
  - Na ficha, `SecaoSessoes`: `sessões com registro mostram Registro no histórico, com link`.
- [ ] **Step 2: Rodar** → falha.
- [ ] **Step 3: Implementar.** O atalho é um `LinkBotao` logo abaixo da situação.
- [ ] **Step 4: Rodar:** `npm run typecheck && npm run lint && npm test` → passa.
- [ ] **Step 5: Commit:** `Leva ao registro pelo painel da sessão e pela ficha`

---

### Task 7: Ponta a ponta e documentação

**Files:**
- Create: `e2e/registro.spec.ts`
- Modify: `docs/instalacao.md`, `README.md`, `docs/superpowers/pendencias-etapas-1-e-2.md`

- [ ] **Step 1: E2E nos dois projetos**, com o relógio em `2026-11-02T12:00-03:00` e o mesmo padrão de `e2e/cobranca.spec.ts` (só navegação dentro do app e vigia de erros do console):
  1. abrir na agenda, na semana anterior, a sessão de Maria Luísa de 29/10;
  2. marcar `Compareceu` e tocar em `Escrever registro`;
  3. escrever o texto, tocar em `Resumir`, ver os quatro campos com `(demonstração)` e tocar em `Salvar registro` → "Registro salvo.";
  4. voltar à agenda: o painel da sessão mostra `Ver registro`;
  5. nenhum erro no console.
- [ ] **Step 2: Guia de instalação:** um passo novo, `1.7 Ligar o resumo com o Claude`, em linguagem simples e no mesmo estilo do guia:
  - criar a conta em `platform.claude.com`;
  - colocar créditos (mínimo de cerca de US$ 5);
  - criar a chave de API;
  - no Supabase, ir em Edge Functions → Secrets e criar `ANTHROPIC_API_KEY`;
  - criar a função `resumir-sessao` pelo editor do painel, colando `supabase/functions/resumir-sessao/index.ts`, e publicar;
  - rodar `20261115120000_registro.sql` no SQL Editor, depois dos dois arquivos anteriores e antes de atualizar o aplicativo;
  - o que ver se der certo e os erros comuns;
  - o custo: cerca de R$ 0,15 a R$ 0,30 por sessão;
  - a chave nunca vai para o aplicativo nem para o GitHub;
  - como trocar para um modelo mais econômico (`CLAUDE_MODELO`).
- [ ] **Step 3: README e pendências.**
  - **README:** mencionar o registro com o Claude.
  - **Pendências:** criar a seção "Etapa 4 (registro): pendências". Ela anota que nomes de outras pessoas (irmãos, colegas, escola) não são trocados, só os do paciente e dos responsáveis, e que o rascunho fica no aparelho até salvar ou sair.
- [ ] **Step 4: Verificação final:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → tudo passa.
- [ ] **Step 5: Commit:** `Adiciona o teste de ponta a ponta do registro e o passo do Claude no guia`
