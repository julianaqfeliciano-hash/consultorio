# Pendências e decisões — Etapas 1 e 2

Registro das decisões tomadas durante a construção das Etapas 1 e 2 e do que ficou para os próximos planos.
Plano: [`plans/2026-10-23-etapas-1-e-2-base-e-agenda.md`](plans/2026-10-23-etapas-1-e-2-base-e-agenda.md).

## Decisões tomadas na construção

1. `ChipSituacao` criado na Tarefa 8 (o plano o produzia, mas não o listava nos arquivos).
2. O ajudante de testes `renderComRotas` cresce a cada tarefa (repositório, autenticação, consultas).
3. Uma única navegação, responsiva: barra inferior abaixo de 768 px e lateral a partir de 768 px.
4. Trabalho isolado num branch próprio, num clone dedicado.
5. Todos os testes rodam com `TZ=Asia/Tokyo`, para provar que as datas não dependem do fuso do aparelho.
6. `src/Provedores.tsx` é o mesmo no app e nos testes.
7. A leitura do banco normaliza `time` (`14:00:00` → `14:00`) e `timestamptz` (→ ISO com `Z`).
8. O cache de consultas é limpo quando a usuária sai.
9. Botão "Voltar para Agendada" e confirmação antes de "Bloquear dias". A tela para remover um bloqueio ficou para depois.
10. A semana inteira (todas as colunas) aparece a partir de 1024 px, sem rolagem lateral. Abaixo disso, um dia por vez.
11. A mensagem padrão do WhatsApp continua como aprovada no design (§5.5), mesmo dizendo "amanhã". Ela é editável em Mais → Configurações.
12. Correções da revisão final:
    - "Mudar horário" só mexe no futuro.
    - Limites nos números das configurações.
    - "Remarcar" só em sessões não cobradas.
    - Sessões canceladas não voltam ao mudar o horário.
    - Bloqueio com ano e aviso de período longo.
    - Datas em Nunito Sans.
    - Ordem alfabética pt-BR.
    - `.node-version` e ajustes no guia.
13. Ao mudar o horário fixo, a sessão antiga que é mantida (cancelada, remarcada, ou que já passou) passa a "ocupar" a ocorrência do novo horário naquela semana: seus `horarioFixoId` e `dataOcorrencia` mudam, mas `inicio` e situação não. Por isso `dataOcorrencia` é uma **chave de ocorrência** e pode ser outro dia da mesma semana de `inicio`.

## Antes de usar de verdade

- O adaptador do Supabase nunca rodou contra um servidor real. Antes de seguir o guia, rodar `supabase.contrato.test.ts` uma vez num projeto Supabase de teste (veja a seção opcional em `docs/instalacao.md`).
- Até existirem a confirmação em duas etapas e o bloqueio automático (Etapa 7), manter o bloqueio de tela do celular e do iPad ligado.
- O plano gratuito do Supabase não faz cópias de segurança. O backup chega na Etapa 7.
- Evitar mudar o **tipo** de um paciente (avaliação ↔ psicoterapia) num dia em que a sessão daquele dia já passou e ainda não foi marcada. Hoje a mudança refaz as sessões a partir de hoje e pode perder a observação dessa sessão.

## Para o plano da Etapa 3 (cobrança) e seguintes

- `mudarTipo` deve atualizar as sessões fixas agendadas no lugar, sem apagar e recriar. Deve respeitar `inicio > agora` e conciliar em vez de sair cedo quando o tipo já é o novo.
- Um algoritmo de mudança de horário que **mova** as sessões agendadas em vez de apagar e regenerar.
- Corrida rara: se a agenda for gerada em outro aparelho entre a criação do novo horário e a troca de chave, a semana fica com duas sessões. Em caso de conflito, remover a sessão futura gerada e tentar de novo.
- Modelar "falta sem aviso + remarcada" na avaliação (§6.4). Hoje remarcar substitui a situação.
- Toda migração nova:
  - `alter default privileges in schema public revoke all on tables from anon`;
  - RLS em toda tabela nova.
- Paginar além do limite de 1000 linhas do PostgREST (relatórios e meses inteiros).
- Readmitir paciente com alta.
- Editar a duração de uma sessão específica.
- Tela para remover um bloqueio.
- Um horário criado depois do horário de hoje gera uma sessão de hoje que já passou.
- Endereço de ficha inválido mostra "não foi possível carregar" em vez de "paciente não encontrado".
- Contagens dos grupos de pacientes ainda em Prata.
- Pequenos ajudantes duplicados (`ok()`, `diaEMes`).
- Teste que fixe as colunas do adaptador Supabase contra as tabelas migradas (PGlite).
- Comentário em `tipos.ts` explicando que `dataOcorrencia` e `horarioFixoId` são chave de ocorrência.
- Observações menores de acessibilidade e UX registradas nas revisões:
  - foco depois de fechar formulários;
  - `role=status`;
  - contraste da faixa de demonstração;
  - pressionar duas vezes durante um salvamento;
  - bloqueio que sobrescreve tentativas;
  - aviso de "carregando" na remarcação.
