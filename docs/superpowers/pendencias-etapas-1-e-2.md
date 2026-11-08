# Pendências e decisões — Etapas 1, 2 e 3

Registro das decisões tomadas durante a construção das Etapas 1, 2 e 3 e do que ficou para os próximos planos.
Planos: [`plans/2026-10-23-etapas-1-e-2-base-e-agenda.md`](plans/2026-10-23-etapas-1-e-2-base-e-agenda.md) e
[`plans/2026-11-01-etapa-3-cobranca.md`](plans/2026-11-01-etapa-3-cobranca.md).

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
- Depois de rodar a migração da cobrança, as sessões já marcadas antes dela (compareceu, faltou sem aviso) ganham o valor de hoje do paciente e aparecem em aberto. Registre o que já foi recebido, com a data em que foi recebido.

## Para o plano da Etapa 3 (cobrança) e seguintes

- ~~RESOLVIDO na Etapa 3~~ `mudarTipo` deve atualizar as sessões fixas agendadas no lugar, sem apagar e recriar. Deve respeitar `inicio > agora` e conciliar em vez de sair cedo quando o tipo já é o novo.
- Um algoritmo de mudança de horário que **mova** as sessões agendadas em vez de apagar e regenerar.
- Corrida rara: se a agenda for gerada em outro aparelho entre a criação do novo horário e a troca de chave, a semana fica com duas sessões. Em caso de conflito, remover a sessão futura gerada e tentar de novo.
- ~~RESOLVIDO na Etapa 3~~ Modelar "falta sem aviso + remarcada" na avaliação (§6.4). Hoje remarcar substitui a situação.
- ~~RESOLVIDO na Etapa 3 (revoke de `anon` por padrão)~~ Toda migração nova (a RLS em tabela nova continua valendo):
  - `alter default privileges in schema public revoke all on tables from anon`;
  - RLS em toda tabela nova.
- ~~RESOLVIDO na Etapa 3~~ Paginar além do limite de 1000 linhas do PostgREST (relatórios e meses inteiros).
- Readmitir paciente com alta.
- Editar a duração de uma sessão específica.
- Tela para remover um bloqueio.
- Um horário criado depois do horário de hoje gera uma sessão de hoje que já passou.
- Endereço de ficha inválido mostra "não foi possível carregar" em vez de "paciente não encontrado".
- Contagens dos grupos de pacientes ainda em Prata.
- Pequenos ajudantes duplicados (`ok()`, `diaEMes`).
- ~~RESOLVIDO na Etapa 3~~ Teste que fixe as colunas do adaptador Supabase contra as tabelas migradas (PGlite).
- Comentário em `tipos.ts` explicando que `dataOcorrencia` e `horarioFixoId` são chave de ocorrência.
- Observações menores de acessibilidade e UX registradas nas revisões:
  - foco depois de fechar formulários;
  - `role=status`;
  - contraste da faixa de demonstração;
  - pressionar duas vezes durante um salvamento;
  - bloqueio que sobrescreve tentativas;
  - aviso de "carregando" na remarcação.

## Etapa 3 (cobrança): pendências

Decisões da revisão final:
- Um mês pago como mês continua cobrado como mês mesmo que a forma de cobrança mude depois. Sessão paga uma a uma nunca entra no total de um mês.
- Um mês pode ter mais de um pagamento: quando o total sobe depois do pagamento, a diferença fica em aberto e é paga à parte. Quando cai, aparece "Pago a mais".

Antes de usar de verdade:
- Rodar `supabase.contrato.test.ts` num projeto de teste antes de usar (a função `registrar_pagamento` e a leitura dos pagamentos com as sessões nunca rodaram num Supabase de verdade).

Para depois:
- Apagar paciente: uma sessão paga impede apagar o paciente (nem `restrict` nem `no action` resolvem). Quando existir a exclusão, apagar os pagamentos primeiro.
- `registrar_pagamento` não confere, no banco, se as sessões são do paciente nem se a lista de sessões combina com o tipo de pagamento (o app confere).
- Os testes de permissão da função não pegam a retirada do `revoke` de `anon`. Faltam índices em `pagamentos.paciente_id` e `pagamentos.avaliacao_id`.
- Desconto em porcentagem negativo só é barrado pelo banco. Há um `'9999-12-31'` que nunca é usado em `resumoAReceber`.
- Ordem e paginação de `listarSessoes` e `listarSessoesDoPaciente` sem teste no adaptador do Supabase.
- `removerSessoes` apaga de 100 em 100: acima de 100 sessões, não é tudo ou nada.
- Arrumação dos testes: fixture alterada sem `finally`, título exagerado no teste da semente, memória sem as checagens de forma e data, arquivo do contrato muito longo.
- O serviço `remarcar` não confere pagamento nem limpa o valor (hoje a tela não deixa chegar lá). Pôr a guarda na próxima mexida em `agenda.ts`.
- `marcarSituacao` e `agendarReposicao` confiam na sessão que a tela manda, que pode estar velha. Títulos de testes a ajustar.
- Os valores da avaliação na ficha não se atualizam quando outro aparelho muda. "Valor previsto" em branco ou inválido salva R$ 0,00 sem avisar.
- Valores da avaliação: leitor de tela repete a cada tecla, sem "Salvando…", nomes parecidos, seletor frágil no teste, duas gravações ao mesmo tempo.
- Painel da sessão: dois campos "Observação" com o formulário de pagamento aberto; foco não entra nem sai do formulário; "Pago em…" não é anunciado; `disabled` e `aria-disabled` misturados.
- Reposição: diz "agendada para outro horário" enquanto carrega; chaves de consulta escritas à mão; hooks repetidos; `PainelSessao.test.tsx` muito longo.
- Mudar a situação de uma falta sem aviso que já tem reposição deixa a sessão de reposição solta (ela aparece na agenda e na lista de amanhã do WhatsApp).
- Ficha → Financeiro: foco se perde ao fechar formulários; sem aviso de sucesso; botões "Registrar pagamento do mês" repetidos sem descrição; o formulário das sessões reaparece ao marcar de novo uma sessão; qualquer pagamento limpa todas as marcas; componente grande.
- "A receber" pede a ficha de cada paciente (4 pedidos por paciente, tudo ou nada). Trocar por um `listarAvaliacoes()` antes de a lista crescer. Falta teste de paciente de psicoterapia com saldo do pacote em aberto.
- "A receber": agrupamento O(k²), `usePagamentosDoMes` confia que recebe o dia 1, ternários aninhados, 44 px conferidos pelo nome da classe.
- Uma parcela, ou a diferença de um mês, registrada em dois aparelhos no mesmo instante pode entrar duas vezes (aparece no histórico e pode ser removida). Um id de pagamento gerado no aparelho tornaria o registro à prova de repetição.
- Avaliação: depois de passar para psicoterapia, a seção da avaliação some, mas o saldo do pacote continua cobrado (não dá para corrigir nem perdoar o resto). Voltar de psicoterapia para avaliação cria uma avaliação nova, e o saldo da antiga some da ficha e do "A receber".
- "A receber" não diz do que é cada dívida (sessões, mês, avaliação): fica para os relatórios (Etapa 6, §9.4).
- Registrar pagamento direto na aba Financeiro (§4.3): hoje só pela ficha e pelo painel da sessão.
- O desconto do parceiro não vem sozinho do parceiro que encaminhou: é digitado.
- O pacote inteiro da avaliação conta como devido desde o início dela.
- Uma ligação de pagamento pode apontar para a sessão de outra conta (as chaves estrangeiras não passam pelo RLS). Hoje só existe uma conta.
- Ao remover um pagamento complementar de um mês, o aviso diz "O mês volta a ficar em aberto.", mas só a diferença volta (a ficha mostra o valor certo logo depois).
