# Sistema do Consultório — Documento de Design

- **Data:** 21/10/2026
- **Status:** aguardando aprovação
- **Para quem:** consultório de psicologia infantojuvenil (avaliação psicológica e psicoterapia), de uso individual — só você acessa.

---

## 1. Objetivo

Um sistema simples, sem mensalidade, para organizar o consultório em um só lugar:
agenda semanal, presenças, cobranças, prontuário com resumo das sessões feito pelo
Claude, documentos com modelos prontos, despesas, recibos e relatórios financeiros.

O sistema é construído agora, com o Claude, e depois funciona sozinho, sem precisar do Claude Code.
Ele roda no **celular, no iPad e no notebook**, com os mesmos dados nos três.

**Sucesso significa:**
- Montar a semana em poucos minutos (os horários fixos já vêm preenchidos).
- Saber, a qualquer momento, quem pagou, quem deve e quanto.
- Registrar a sessão falando, com o resumo pronto em segundos.
- Gerar declaração, relatório ou laudo a partir de um modelo, sem redigitar dados.
- Fechar o mês com números prontos para o carnê-leão.

---

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Usuários | Só você. Sem secretária, sem acesso de pacientes. |
| Aparelhos | Celular, iPad e notebook, com dados sincronizados. |
| Forma de construir | Aplicativo pela internet (instalável na tela inicial) + banco de dados gratuito (Supabase, servidor em São Paulo). |
| WhatsApp | O sistema **não envia** mensagens. Mostra a lista de amanhã com botão que abre a conversa no WhatsApp para você confirmar manualmente. |
| Registro da sessão | Você fala, o próprio aparelho transforma a fala em texto (grátis), e o Claude organiza o resumo (pago à parte, centavos por sessão). |
| Recibos | Não é obrigatório ter recibo de tudo. O sistema guarda os recibos que você emitir. |
| Despesas | Registradas, com comprovante, e usadas nos relatórios e no livro-caixa. |
| Código | Repositório próprio e privado no GitHub, separado dos vídeos da Brincário. |

---

## 3. O que fica de fora (por enquanto)

- Envio automático de mensagens (WhatsApp, SMS, e-mail).
- Agendamento feito pelo próprio paciente.
- Emissão do recibo dentro do Receita Saúde (a Receita não oferece integração; o sistema só organiza).
- Emissão de nota fiscal.
- Mais de um usuário.
- Envio de arquivo de áudio gravado (a fala é transformada em texto pelo próprio aparelho).
- Funcionar sem internet (o aplicativo abre, mas os dados precisam de conexão; o texto ditado não se perde, veja §7).

---

## 4. Telas

No celular, uma barra inferior com 5 abas. No iPad e no notebook, a mesma navegação na lateral.

### 4.1 Agenda
- **Aviso “Amanhã: N pacientes”** no topo. Ao abrir: horário, paciente, responsável, telefone,
  botão **WhatsApp** (abre a conversa com uma mensagem pronta, que você pode editar antes de enviar)
  e marcação **“confirmado”**. Setas permitem ver outros dias.
- **Visão da semana** com os horários fixos já preenchidos. No celular, um dia por vez com deslize;
  no iPad/notebook, a semana inteira.
- **Toque numa sessão** abre o painel da sessão:
  - situação (compareceu / faltou com aviso / faltou sem aviso / cancelada por mim / remarcar);
  - pagamento (pago / pendente), quando a sessão é cobrada individualmente;
  - registro da sessão (§7);
  - marcação “sessão com os responsáveis”.
- Botão **“+”** para sessão avulsa (fora do horário fixo).
- Botão **“Bloquear dias”** (férias, feriados).

### 4.2 Pacientes
- Grupos: **em avaliação**, **em psicoterapia**, **alta**, **lista de espera**. Busca por nome.
- **Ficha do paciente**:
  - Criança/adolescente: nome, data de nascimento, CPF (opcional, usado no carnê-leão), escola, série, observações.
  - Responsáveis (um ou mais): nome, parentesco, CPF, telefone, e-mail; marcação de **responsável principal** (recebe a confirmação) e de **pagador** (vai no recibo e no carnê-leão).
  - Atendimento: tipo (avaliação ou psicoterapia), data de entrada, data de alta, **quem encaminhou** (parceiro).
  - Cobrança: forma (**por sessão** ou **por mês**), **valor da sessão** deste paciente.
  - Horários fixos (dia da semana + hora).
  - Se em avaliação: sessões previstas, valor previsto, desconto, valor final, etapas (§5.4).
- Abas dentro da ficha: **Sessões** (histórico + registros), **Documentos**, **Financeiro** (o que deve, o que pagou).
- Um paciente pode passar de **avaliação** para **psicoterapia** sem perder o histórico.

### 4.3 Financeiro
- **A receber:** lista de quem deve, quanto e desde quando.
- **Pagamentos:** registrar e consultar.
- **Despesas:** registrar, com foto do comprovante; despesas fixas que se repetem todo mês.
- **Recibos:** registrar os emitidos, com o PDF anexado.

### 4.4 Relatórios
- Resumo do mês, gráficos dos últimos 12 meses, carnê-leão (§9).

### 4.5 Mais
- Modelos de documentos, parceiros, cópia de segurança, configurações
  (seus dados profissionais, valores padrão, mensagem do WhatsApp, tempo de bloqueio).

---

## 5. Regras da agenda

### 5.1 Horários fixos
- Cada paciente pode ter um ou mais horários fixos semanais (ex.: terça às 14h).
- O sistema mantém sempre as **próximas 4 semanas** geradas a partir dos horários fixos.
  Toda vez que a agenda é aberta, ele completa o que faltar — sem duplicar.
- **Mudar uma sessão só** (remarcar/cancelar) não altera o horário fixo.
- **Mudar o horário fixo de vez:** editado na ficha, com a data a partir da qual vale.
  Sessões futuras que vieram do horário antigo e continuam “agendadas” passam para o novo horário;
  sessões já realizadas ou remarcadas à mão não mudam.
- Duração padrão da sessão: 50 minutos (ajustável nas configurações e em cada sessão).

### 5.2 Situação de cada sessão

| Situação | É cobrada? |
|---|---|
| Agendada | — (ainda não aconteceu) |
| Compareceu | Sim |
| Faltou sem aviso | Sim |
| Faltou com aviso prévio | Não |
| Cancelada por mim | Não |
| Remarcada | Não — a cobrança fica na nova data |

- **Remarcar:** a sessão original fica registrada como “remarcada” e uma nova sessão é criada na nova data, ligada à original.
- **Sessão com os responsáveis:** conta e é cobrada como uma sessão normal.

### 5.3 Bloquear dias
- Você escolhe um período e um motivo (ex.: “Férias”). As sessões já marcadas nesse período passam para
  “cancelada por mim” (sem cobrança) e o sistema não gera novas sessões ali.

### 5.4 Avaliação
- Sessões previstas: padrão 10 (ajustável por paciente).
- O sistema mostra **“sessão X de N”**, contando só as sessões realizadas.
- Lista de etapas para marcar: entrevista com os responsáveis, testes aplicados, contato com a escola,
  devolutiva, laudo entregue. (Você pode acrescentar etapas.)

### 5.5 Lista de amanhã
- Mostra as sessões do dia seguinte (com setas para outros dias), ordenadas por horário.
- Botão WhatsApp abre `wa.me` com o número do responsável principal e a mensagem modelo preenchida.
  Mensagem padrão (editável nas configurações):
  > Olá, {responsável}! Passando para lembrar da sessão de {paciente} amanhã, {dia}, às {hora}. Caso não possa comparecer, por favor avise com antecedência. Até amanhã!
- Marcação “confirmado” fica visível também na agenda.

---

## 6. Regras de cobrança

### 6.1 Valor
- A forma de cobrança (por sessão ou por mês) vale para a **psicoterapia**. A **avaliação** é cobrada como pacote (§6.4).
- Cada paciente tem o **seu** valor de sessão.
- Cada sessão guarda o valor vigente no dia em que aconteceu. Reajustes não mudam o passado.

### 6.2 Quem paga por sessão
- Cada sessão cobrada fica **pendente** até ser paga.
- Um pagamento pode quitar uma ou várias sessões de uma vez (ex.: um Pix para duas sessões).

### 6.3 Quem paga por mês
- No mês civil, o sistema soma as sessões cobradas (compareceu + faltou sem aviso).
- Situação do mês: **em andamento** (mês atual), **devendo** (mês terminou e não foi pago), **pago**.
- **Não existe pagamento parcial:** registrar o pagamento do mês quita o total.
- Se, depois de pago, alguma sessão daquele mês mudar de situação e o total mudar, o sistema mostra um aviso com a diferença.

### 6.4 Avaliação
- **Valor previsto** (padrão nas configurações) com **desconto** opcional, em reais ou porcentagem (ex.: parceiros) → **valor final**.
- Pagamentos à vista ou em parcelas; o sistema mostra quanto falta do pacote.
- **Falta sem aviso na avaliação:** cobrada **à parte**, no valor da sessão do paciente, e a sessão é remarcada para o pacote continuar completo.

### 6.5 Pagamento
- Campos: data, valor, forma (Pix, dinheiro, cartão, transferência), observação, o que está sendo pago
  (sessões, mês ou pacote de avaliação).

### 6.6 Despesas
- Campos: data, descrição, categoria (aluguel, testes e material, CRP, cursos e supervisão, outros), valor,
  “entra no livro-caixa?”, foto/PDF do comprovante.
- **Despesas fixas:** cadastradas uma vez (ex.: aluguel, todo dia 5) e lançadas automaticamente todo mês; você só confirma.

### 6.7 Recibos
- Registro do recibo emitido no Receita Saúde: data, número, valor, pagador (nome e CPF), paciente,
  pagamento correspondente e o **PDF anexado**.
- Não há cobrança de recibo para todo pagamento; a lista de recibos pode ser filtrada por mês.

---

## 7. Registro da sessão (com o Claude)

**Fluxo:**
1. No painel da sessão, você toca no campo de texto e no **microfone do teclado** (ou no botão “Ditar”, quando o navegador permitir) e fala.
   O aparelho transforma a fala em texto, de graça.
2. Toca em **“Resumir”**. O sistema envia o texto ao Claude e recebe o resumo organizado em quatro campos:
   **Como chegou**, **O que foi trabalhado**, **Observações**, **Próximos passos**.
3. Você revisa, ajusta e **salva**. O texto falado também fica guardado junto do registro.

**Regras:**
- **Antes de enviar**, o sistema troca o nome do paciente e dos responsáveis por marcadores
  (ex.: `[P]`, `[R1]`). Quando o resumo volta, os nomes são recolocados. O Claude nunca recebe os nomes.
- O Claude é instruído a **não inventar**: usa só o que foi dito; campo sem informação fica vazio.
- O resumo nunca é salvo sem a sua revisão.
- **Nada se perde:** o texto ditado fica guardado no aparelho como rascunho até ser salvo
  (sem internet, ou se o Claude falhar, você tenta de novo depois). O rascunho é apagado do aparelho depois de salvo.
- É possível escrever o registro sem usar o Claude.

**Custo:** com o modelo mais capaz (Claude Opus 5.5), cerca de R$ 0,20 a R$ 0,30 por sessão.
O modelo fica numa configuração do servidor e pode ser trocado por um mais econômico sem mudar o sistema.

---

## 8. Documentos e modelos

### 8.1 Pasta do paciente
- Enviar PDF ou **foto tirada pelo celular** (funciona como um escaneamento).
- Tipos: documento recebido, teste escaneado, termo assinado, documento emitido, recibo.
- Fotos são reduzidas automaticamente antes de enviar (para caber no espaço gratuito).

### 8.2 Modelos prontos
1. **Declaração de comparecimento** — com datas e horários das sessões escolhidas.
2. **Relatório psicológico** — estrutura da Resolução CFP nº 06/2019 (identificação, descrição da demanda, procedimento, análise, conclusão).
3. **Laudo psicológico** — estrutura da Resolução CFP nº 06/2019 (identificação, descrição da demanda, procedimento, análise, conclusão, referências).
4. **Contrato terapêutico / termo de consentimento** para os responsáveis — regra de faltas (falta sem aviso prévio é cobrada), forma de pagamento, sigilo, e autorização para uso de inteligência artificial na organização dos registros.

**Como gerar:** escolher o modelo → o sistema preenche paciente, responsável, datas, seu nome e CRP →
você edita o texto → gera o **PDF** → o PDF é salvo automaticamente na pasta do paciente como “documento emitido”.

O texto de cada modelo pode ser editado em **Mais → Modelos**, usando campos como `{paciente.nome}` e `{responsavel.nome}`.

---

## 9. Relatórios

### 9.1 Definições
- **Recebido no mês:** soma dos pagamentos com data no mês (dinheiro que entrou — base do carnê-leão).
- **Atendido no mês:** soma das sessões cobradas no mês (psicoterapia e faltas sem aviso) + valor final das avaliações iniciadas no mês.
- **A receber:** tudo o que está em aberto, de qualquer mês.
- **Resultado:** recebido no mês − despesas do mês.
- **Pacientes novos:** pacientes com data de entrada no mês (a data de entrada é preenchida automaticamente com a primeira sessão e pode ser corrigida).
- **Pacientes atendidos:** pacientes com pelo menos uma sessão realizada no mês.
- **Altas:** pacientes com data de alta no mês.
- **Taxa de faltas:** faltas ÷ (sessões realizadas + faltas).

### 9.2 Resumo do mês
Recebido, atendido, a receber, despesas, resultado, sessões realizadas, faltas (com e sem aviso),
taxa de faltas, pacientes novos, pacientes atendidos, altas.

### 9.3 Gráficos (últimos 12 meses)
- Entradas × despesas.
- Sessões realizadas por mês.
- Pacientes novos por mês.
- Avaliação × psicoterapia (valor recebido).
- Pacientes encaminhados por parceiro.

### 9.4 Quem está devendo
Lista por paciente: valor em aberto, desde quando, e do que se trata (sessões, mês, avaliação).

### 9.5 Carnê-leão
Para o mês escolhido:
- Lista de pagamentos: data, valor, pagador (nome e CPF), paciente (nome e CPF, se houver), forma.
- Total recebido de pessoas físicas.
- Despesas marcadas como “livro-caixa”, com total.
- Exportar em **planilha (CSV)** e **PDF**, para você ou seu contador lançarem.

O sistema prepara os números; quem lança no carnê-leão é você ou o contador. Regras fiscais devem ser confirmadas com o contador.

---

## 10. Segurança, privacidade e cópia de segurança

- **Login** com e-mail e senha + **confirmação em duas etapas** (código num aplicativo autenticador), recomendada.
- **Cadastro fechado:** depois que sua conta é criada, ninguém mais consegue se cadastrar.
- **Bloqueio automático:** após 15 minutos sem uso (ajustável), o sistema pede a senha de novo.
- **Acesso aos dados:** regras no banco garantem que só a sua conta lê e grava qualquer informação ou arquivo.
- **Onde ficam os dados:** Supabase, servidor em São Paulo, com dados protegidos no servidor.
- **Claude:** recebe só o texto do registro, sem nomes (§7). No serviço pago do Claude (API), os dados não são usados para treinar o modelo.
- **Prontuário:** pacientes com alta vão para o arquivo; nada é apagado automaticamente. Apagar um paciente exige confirmação e mostra o aviso da guarda mínima de 5 anos.
- **Cópia de segurança:**
  - Botão **“Baixar backup”** gera uma planilha (.xlsx, uma aba por assunto) com todos os dados e um .zip com todos os documentos.
  - Lembrete mensal para fazer a cópia e guardá-la no computador ou no Google Drive.
  - O plano gratuito do Supabase não faz cópias automáticas — por isso o lembrete é importante.

---

## 11. Custos

| Item | Custo |
|---|---|
| Hospedagem do aplicativo (Cloudflare Pages) | R$ 0 |
| Banco de dados e arquivos (Supabase, plano gratuito) | R$ 0 |
| Resumos com o Claude (API) | ~R$ 0,20–0,30 por sessão (~R$ 20–30/mês para ~100 sessões); créditos pré-pagos, mínimo ~US$ 5 |

---

## 12. Parte técnica

### 12.1 Arquitetura
- **Aplicativo:** React + TypeScript + Vite, Tailwind CSS, instalável (PWA). Gráficos com Recharts.
  PDFs gerados no próprio aparelho. Hospedado no **Cloudflare Pages** (gratuito e permite uso profissional),
  publicado automaticamente a partir do repositório privado no GitHub.
- **Supabase (região São Paulo):**
  - Postgres com **Row Level Security** em todas as tabelas (`dono = auth.uid()`).
  - Auth: e-mail/senha + MFA (TOTP); cadastro desativado após criar a conta.
  - Storage: bucket privado `documentos`, com as mesmas regras de acesso; links temporários para abrir arquivos.
  - Edge Function `resumir-sessao`: recebe o texto já sem nomes, chama a API do Claude com o SDK oficial
    (`@anthropic-ai/sdk`), modelo padrão `claude-opus-5-5` (configurável por variável), e devolve os quatro campos em formato estruturado.
    A chave do Claude fica só nos segredos do Supabase, nunca no aplicativo.
- **Fuso horário:** America/Sao_Paulo. Valores em reais (centavos inteiros no banco).

### 12.2 Dados (tabelas principais)
- `configuracoes` — seus dados profissionais (nome, CRP, CPF, endereço, telefone), valores e durações padrão, mensagem do WhatsApp, tempo de bloqueio.
- `parceiros` — nome, profissão, contato.
- `pacientes` — dados da criança, status (lista de espera / ativo / alta), tipo atual, datas de entrada e alta, parceiro, forma de cobrança, valor da sessão.
- `responsaveis` — ligados ao paciente; principal; pagador.
- `horarios_fixos` — paciente, dia da semana, hora, duração, válido de/até.
- `avaliacoes` — paciente, início/fim, sessões previstas, valor previsto, desconto, valor final, etapas.
- `sessoes` — paciente, data e hora, duração, tipo, com responsáveis, origem (fixa/avulsa), situação, valor, confirmada, ligação com remarcação, avaliação; registro (texto falado + quatro campos).
- `pagamentos` — paciente, data, valor, forma, referência (sessões / mês / avaliação); `pagamento_sessoes` liga pagamentos a sessões.
- `despesas` e `despesas_fixas`.
- `recibos` — ligados a pagamento e paciente, com arquivo.
- `documentos` — paciente, tipo, título, data, arquivo.
- `modelos_documento` — texto editável com campos.
- `bloqueios` — período e motivo.

### 12.3 Regras de negócio
As regras de §5, §6 e §9 ficam num módulo separado (`src/regras/`), em funções puras e testáveis:
geração de sessões a partir dos horários fixos e bloqueios; o que é cobrado e quanto; fechamento do mês;
saldo da avaliação; cálculos dos relatórios e do carnê-leão; troca e restauração de nomes no registro.

### 12.4 Erros
- Sem internet: aviso claro; rascunhos do registro guardados no aparelho.
- Falha do Claude: mensagem e botão “tentar de novo”; o texto falado nunca se perde.
- Arquivo grande demais: aviso antes do envio.
- Geração de sessões é idempotente (nunca duplica).

### 12.5 Testes
- Testes automáticos (Vitest) para todas as regras de §12.3, escritos antes do código (TDD).
- Testes das regras de acesso do banco (nenhum dado acessível sem login).
- Teste de ponta a ponta (Playwright) dos fluxos principais: cadastrar paciente → agenda gerada → marcar presença → pagar → relatório.
- Verificação manual no celular, no iPad e no notebook antes de cada entrega.

### 12.6 Entregas por etapas
Para você começar a usar antes de tudo ficar pronto:
1. Base: login, configurações, pacientes e responsáveis.
2. Agenda: horários fixos, semana, lista de amanhã, presença, bloqueios.
3. Cobrança: valores, pagamentos, por sessão, mensal, avaliação, a receber.
4. Registro da sessão com o Claude.
5. Documentos e modelos.
6. Despesas, recibos, relatórios e carnê-leão.
7. Cópia de segurança, duas etapas, bloqueio automático e acabamento.

---

## 13. Instalação — o que você vai fazer (uma vez, com guia passo a passo)

1. Criar o repositório privado `consultorio` no GitHub e dar acesso ao Claude.
2. Criar conta gratuita no **Supabase** e um projeto na região São Paulo.
3. Criar conta gratuita no **Cloudflare** e ligar ao repositório.
4. Criar conta no **console de desenvolvedores da Anthropic**, colocar créditos e gerar a chave da API.
5. Criar seu login no sistema e ativar as duas etapas.
6. No celular e no iPad: abrir o endereço e “Adicionar à Tela de Início”.

---

## 14. Riscos e limites

- **Planos gratuitos:** Supabase tem 500 MB de dados e 1 GB de arquivos (milhares de PDFs); se o sistema ficar 7 dias sem uso, o projeto “adormece” e é reativado com um clique. As condições dos planos gratuitos podem mudar.
- **Sem cópia automática** no plano gratuito — mitigado pelo backup mensal com lembrete.
- **Ditado por voz** depende do aparelho; a qualidade é boa em português, mas o texto deve ser revisado.
- **Sigilo:** dados de saúde de crianças são dados sensíveis (LGPD). As medidas de §10 reduzem o risco; o termo de consentimento (§8.2) informa os responsáveis.
