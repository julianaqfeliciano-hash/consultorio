# Guia de instalação

Este guia leva você, passo a passo, do zero até o sistema funcionando no seu celular, no iPad e no notebook.
Você faz tudo **uma vez só**, e leva cerca de 40 minutos. Não precisa saber programar: é só clicar, copiar e colar.

**O que você vai montar**

- Um **banco de dados** no **Supabase**, onde ficam guardados os pacientes, os horários e as sessões. O servidor fica em São Paulo.
- Um **endereço na internet** no **Cloudflare**, onde o sistema fica publicado. Ele é aberto no celular, no iPad e no notebook, e funciona como um aplicativo.

**Custo:** R$ 0. Os dois serviços têm plano gratuito, que basta para o consultório, e normalmente não pedem cartão de crédito.

**Antes de começar, tenha à mão**

- O seu e-mail (de preferência o que você já usa no consultório).
- O acesso à sua conta do GitHub, onde está o repositório privado `consultorio`.
- Um bloco de notas ou um gerenciador de senhas para guardar as informações que aparecem pelo caminho.
- Se puder, use o **notebook** nesta instalação: as telas são maiores e copiar e colar é mais fácil.

> **Aviso sobre os nomes na tela.** O Supabase e o Cloudflare mudam o desenho dos seus painéis de tempos em tempos.
> Se um botão estiver num lugar um pouco diferente do que está escrito aqui, procure pelo **nome** dele (entre aspas):
> costuma estar ali perto. Se travar, tire um print da tela e mostre para quem está te ajudando
> (cuidado para o print não mostrar senhas nem a chave secret).

---

## Parte 1 — O banco de dados (Supabase)

### 1.1 Criar a conta

1. Abra **https://supabase.com** e clique em **“Start your project”** (ou em **“Sign in”**, se já tiver conta).
2. Crie a conta com o seu e-mail ou com o GitHub. Se pedir, confirme o e-mail.
3. Se o Supabase pedir para criar uma **organização**, aceite o nome sugerido (ou use “Consultório”) e escolha o plano **Free** (gratuito).

### 1.2 Criar o projeto

> **Importante:** crie um projeto **novo e vazio**, só para o consultório. Não use um projeto onde já existe outro sistema.
> A instalação do passo 1.3 tira o acesso de visitantes sem login a todas as tabelas do projeto, e isso pode atrapalhar
> qualquer outro sistema que esteja no mesmo lugar.

1. No painel, clique em **“New project”**.
2. Preencha:
   - **Name** (nome): `consultorio`
   - **Database Password** (senha do banco): clique em **“Generate a password”** para o Supabase criar uma senha forte,
     ou crie uma sua. **Copie e guarde essa senha** agora (num gerenciador de senhas ou num papel guardado em lugar seguro).
     Depois que você sair desta tela, o Supabase não mostra a senha de novo.
   - **Region** (região): escolha **South America (São Paulo)**.
3. Se aparecerem outras opções (por exemplo, de segurança), **deixe como vieram**.
4. Clique em **“Create new project”** e espere de 1 a 2 minutos, até o painel do projeto aparecer.

> **Sobre a senha do banco:** o sistema **não usa** essa senha para funcionar. Ela é uma chave-mestra do banco.
> **Nunca** a envie para ninguém, por nenhum meio (e-mail, WhatsApp, mensagem), e **não** a cole em nenhum site.

### 1.3 Criar as tabelas do sistema

O sistema precisa de um conjunto de tabelas (pacientes, responsáveis, horários, sessões etc.). Elas são criadas por
um texto pronto, que está guardado no repositório do GitHub. Você vai copiá-lo de lá e colá-lo no Supabase.

**Copiar o texto no GitHub**

1. Abra o repositório `consultorio` no GitHub (https://github.com/julianaqfeliciano-hash/consultorio). Entre na sua conta, se pedir.
2. Confira que está no ramo principal, chamado **`main`** (aparece num botão no alto da lista de arquivos).
3. Clique na pasta **`supabase`**, depois na pasta **`migrations`**, e depois no arquivo **`20261023120000_base.sql`**.
4. No alto do arquivo, do lado direito, clique no botão com o desenho de dois quadradinhos sobrepostos
   (**“Copy raw file”**, “Copiar o arquivo bruto”). Isso copia o texto inteiro.
   - Se não achar o botão: clique em **“Raw”**, na página que abrir aperte **Ctrl + A** (no Mac, **⌘ + A**) para
     selecionar tudo e depois **Ctrl + C** (**⌘ + C**) para copiar.

**Colar e rodar no Supabase**

5. De volta ao painel do Supabase, na barra lateral esquerda, clique em **“SQL Editor”**.
6. Clique em **“New query”** (nova consulta). Abre uma folha em branco.
7. Clique dentro da folha e cole o texto (**Ctrl + V**, no Mac **⌘ + V**). Vão aparecer muitas linhas; é normal.
8. Clique no botão **“Run”** (executar), no canto inferior direito da folha.
9. **O que você deve ver:** uma mensagem de sucesso embaixo, algo como **“Success. No rows returned”**.

**Se aparecer um erro em vermelho**, não continue. As causas mais comuns:

- Aparece **“already exists”** (já existe): o texto já tinha sido rodado antes neste projeto. **Não rode de novo.**
- O texto foi colado pela metade. Volte ao passo 4, copie de novo e cole numa consulta nova.

Se não resolver, tire um print do erro e peça ajuda antes de seguir
(cuidado para o print não mostrar senhas nem a chave secret).

### 1.4 Criar o seu login

O sistema é só seu: ninguém mais consegue entrar. Você vai criar o único login que vai existir.

1. Na barra lateral, clique em **“Authentication”** (autenticação) e depois em **“Users”** (usuários).
2. Clique em **“Add user”** e escolha **“Create new user”**.
3. Preencha:
   - **Email address:** o e-mail que você vai usar para entrar no sistema.
   - **Password:** uma **senha forte e só sua**: pelo menos 12 caracteres, misturando letras, números e símbolos.
     Não use a mesma senha de outro lugar. Guarde-a num gerenciador de senhas.
   - Se aparecer a opção **“Auto Confirm User”** (confirmar o usuário automaticamente), **deixe marcada**.
     Assim você não precisa esperar um e-mail de confirmação.
4. Clique em **“Create user”**. O seu e-mail passa a aparecer na lista.

> **Nunca apague esse usuário.** Todos os dados do consultório ficam ligados a ele: se ele for apagado,
> **tudo é apagado junto**.

### 1.5 Fechar o cadastro para outras pessoas

Por padrão, qualquer pessoa que descobrisse o endereço do sistema poderia tentar criar uma conta. Vamos impedir isso.

1. Ainda em **“Authentication”**, procure a página de configuração de entrada, chamada **“Sign In / Providers”**
   (em algumas versões aparece como **“Providers”**; fica numa lista de configurações dentro de Authentication).
2. Procure a opção **“Allow new users to sign up”** (permitir que novas pessoas se cadastrem) e **desligue-a**.
3. Clique em **“Save changes”** (salvar), se o botão aparecer.

Pronto: a partir de agora, só existe o login que você criou no passo 1.4.

### 1.6 Copiar o endereço do projeto e a chave

O sistema precisa saber **onde** está o banco e ter a **chave pública** para falar com ele. São dois textos.

1. Na barra lateral, clique no ícone de engrenagem, **“Project Settings”** (configurações do projeto).
2. Procure a página de API (chamada **“API Keys”** ou **“API”**; o endereço pode estar também em **“Data API”**).
3. Copie e guarde no seu bloco de notas:
   - **Project URL** (endereço do projeto). Parece com `https://abcdefghijkl.supabase.co`.
   - **Publishable key** (chave pública). É um texto longo que começa com `sb_publishable_`.
     (Se a tela só mostrar a chave antiga chamada **“anon public”**, ela também serve.)

> **Cuidado com a outra chave.** Na mesma página existe uma chave chamada **“secret”** (ou **“service_role”**).
> Ela abre o banco **sem nenhuma proteção**. **Nunca** a copie para o sistema, nunca a envie a ninguém.
> **Só o Project URL e a Publishable key** vão para o Cloudflare.
>
> Não se preocupe com a Publishable key ser “pública”: ela é feita para ficar dentro do sistema. Quem protege os dados
> são as regras do banco que você criou no passo 1.3, que só deixam entrar quem tem o login do passo 1.4.

---

## Parte 2 — O endereço na internet (Cloudflare)

### 2.1 Criar a conta

1. Abra **https://dash.cloudflare.com** e clique em **“Sign up”** (criar conta).
2. Informe e-mail e senha (outra senha forte, só para o Cloudflare) e confirme o e-mail, se pedirem.
3. Se perguntarem qual plano, escolha o **Free** (gratuito).

### 2.2 Publicar o sistema

1. Na barra lateral, clique em **“Workers & Pages”** (em algumas versões fica dentro de **“Compute”**).
2. Clique em **“Create”** (criar). Escolha a aba **“Pages”** e a opção para **importar um repositório do Git**
   (**“Import an existing Git repository”**), clicando em **“Get started”**.
   - Se a tela só mostrar a opção de “Workers”, procure perto do final da página um link falando em **Pages**
     (algo como “Looking to deploy Pages?”).
3. Clique em **“Connect GitHub”**. Abre uma janela do GitHub pedindo permissão:
   - Em **“Repository access”**, escolha **“Only select repositories”** e marque **`consultorio`**.
   - Clique em **“Install & Authorize”** (instalar e autorizar).
4. De volta ao Cloudflare, selecione o repositório **`consultorio`** e clique em **“Begin setup”** (começar a configurar).
5. Preencha a configuração:
   - **Project name:** `consultorio` (esse nome entra no endereço final do sistema).
   - **Production branch:** `main`.
   - **Framework preset:** escolha **“Vite”**.
   - **Build command:** `npm run build` (já vem preenchido ao escolher Vite; confira).
   - **Build output directory:** `dist` (idem).
6. Abra a parte de variáveis, **“Environment variables (advanced)”**, e clique em **“Add variable”** duas vezes.
   Digite os nomes **exatamente** assim (letras maiúsculas, com os sublinhados) e cole os valores que você guardou no passo 1.6:

   | Nome da variável | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | o **Project URL** |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | a **Publishable key** |

   Confira se não ficou nenhum espaço antes ou depois do que você colou.
7. Clique em **“Save and Deploy”** (salvar e publicar). Espere de 1 a 3 minutos, enquanto o Cloudflare monta o sistema.
8. Quando terminar, aparece o endereço do sistema, no formato **`https://consultorio.pages.dev`** (às vezes com letras
   ou números extras no meio do nome). **Anote esse endereço.**

### 2.3 Primeiro teste

1. Abra o endereço no navegador. Deve aparecer a tela **“Acesso ao sistema”**, com os campos **E-mail** e **Senha**.
2. Entre com o e-mail e a senha do passo 1.4. Você chega na **Agenda**, vazia.

**Atenção:** se, em vez disso, aparecer uma **faixa amarela** escrita **“Modo demonstração — os dados são fictícios…”**,
as duas variáveis não chegaram ao sistema. Vá para a seção **“Se algo der errado”**, no fim deste guia.

---

## Parte 3 — Instalar como aplicativo

O sistema pode ficar com um ícone na tela, como um aplicativo qualquer. Faça isso em cada aparelho que você usar.

**iPhone e iPad (Safari)** — use o **Safari**, não outro navegador:

1. Abra o endereço do sistema (o `….pages.dev` do passo 2.2).
2. Toque no botão **Compartilhar** (um quadrado com uma seta para cima).
3. Role a lista e toque em **“Adicionar à Tela de Início”**.
4. Toque em **“Adicionar”**. O ícone do consultório aparece na tela.

**Celular Android (Chrome):** abra o endereço, toque no menu (os três pontinhos) e escolha **“Instalar app”**
(ou **“Adicionar à tela inicial”**).

**Notebook (Chrome ou Edge):** abra o endereço. Do lado direito da barra de endereço aparece um **ícone de instalar**
(um pequeno monitor com uma seta). Clique nele e depois em **“Instalar”**.

Nos três casos, depois de instalado, você abre o sistema pelo ícone, sem digitar o endereço de novo.

---

## Parte 4 — Primeiro acesso

1. Abra o sistema e entre com o seu e-mail e a sua senha.
2. Vá em **Mais → Configurações**. Confira os seus dados (nome, CRP, telefone, endereço) e ajuste o que precisar.
   Aqui também ficam a **duração padrão da sessão** e a **mensagem do WhatsApp** (veja a dica abaixo). Toque em **Salvar**.
3. Vá em **Mais → Parceiros** e cadastre quem encaminha pacientes para você (médicos, escolas, outros profissionais).
4. Vá em **Pacientes → Novo paciente**. Preencha o nome, o tipo de atendimento (avaliação ou psicoterapia) e a cobrança.
   Ao salvar, abre a ficha do paciente. Nela, acrescente o **responsável** (o principal recebe a confirmação das sessões)
   e o **horário fixo** da semana.
5. Abra a **Agenda**. As sessões dos próximos dias aparecem sozinhas, a partir dos horários fixos.
   Toque numa sessão para marcar se o paciente compareceu, faltou ou se a sessão foi cancelada ou remarcada.
   O aviso **“Amanhã: N pacientes”**, no alto da Agenda, abre a lista para confirmar as sessões pelo WhatsApp.

**Dica sobre a mensagem do WhatsApp.** O texto pronto fala em **“amanhã”**. Se um dia você usar a lista para outro dia
(por exemplo, na sexta, para avisar quem vem na segunda), troque o texto em **Mais → Configurações → Mensagem do WhatsApp**:
tire a palavra “amanhã” e deixe só o campo `{dia}`, que mostra o dia certo (segunda-feira, por exemplo).
Os campos disponíveis são `{responsável}`, `{paciente}`, `{dia}` e `{hora}`.
Na própria lista, as setas **“Dia anterior”** e **“Próximo dia”** mudam o dia mostrado.

**O que esta primeira versão faz, e o que vem depois.** Agora o sistema tem login, configurações, parceiros, pacientes,
agenda semanal e a lista de amanhã. As telas **Financeiro** e **Relatórios** aparecem “em construção”: a cobrança,
o registro das sessões, os documentos e os relatórios chegam nas próximas etapas.

**Cópia de segurança.** O plano gratuito do Supabase **não faz cópias automáticas** dos dados. O botão “Baixar backup”
e o lembrete mensal chegam numa etapa futura; até lá, nenhuma cópia é feita sozinha.

**Use o sistema pelo menos uma vez por semana.** No plano gratuito, o Supabase “adormece” o projeto depois de 7 dias sem uso
(veja “Se algo der errado”).

---

## Se algo der errado

**Aparece a faixa amarela “Modo demonstração” no endereço de verdade.**
As duas variáveis do Cloudflare não foram lidas. No Cloudflare, abra o projeto `consultorio` e vá em **Settings**
(configurações) e na parte de variáveis (**Environment variables**). Confira se os nomes estão exatamente
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, se os valores estão certos e sem espaço sobrando, e se foram
salvos para o ambiente de **produção** (**Production**). Depois peça uma nova publicação: abra a aba de publicações
(**Deployments**), no menu (os três pontinhos) da mais recente escolha **“Retry deployment”** (tentar de novo).
As variáveis só são lidas na hora de montar o sistema, então mudar uma variável **sempre** exige publicar de novo.

**A página fica em branco.**
Quase sempre é um erro de digitação no **Project URL**: ele precisa começar com `https://`, terminar em `.supabase.co`
e não ter espaços. Confira as duas variáveis (como acima), corrija e publique de novo.

**A publicação falha logo no começo, com uma mensagem sobre a versão do “Node”.**
Acrescente mais uma variável, `NODE_VERSION`, com o valor `22` (no mesmo lugar das outras duas, como descrito acima) e publique de novo.

**“E-mail ou senha incorretos.”**
Confira se o e-mail é o do passo 1.4 e tente de novo, digitando a senha com calma (atenção às maiúsculas).
Se ela se perdeu, defina uma nova no Supabase, **sem apagar o usuário**:

1. Abra o Supabase, entre no projeto `consultorio` e vá em **Authentication → Users**.
2. Clique no seu e-mail na lista e procure uma opção para definir ou redefinir a senha.
   (O e-mail de recuperação **não funciona** neste sistema: ainda não existe a tela para digitar a nova senha.)
3. Se não houver essa opção, vá em **SQL Editor → New query** e cole o texto abaixo. Troque **só**
   `COLE-AQUI-A-NOVA-SENHA` pela nova senha e `seu@email.com` pelo seu e-mail, mantendo as aspas simples em volta
   dos dois, e clique em **Run**:

   ```sql
   update auth.users
   set encrypted_password = crypt('COLE-AQUI-A-NOVA-SENHA', gen_salt('bf'))
   where lower(email) = lower('seu@email.com')
   returning email;
   ```

   - Na nova senha, **não use o apóstrofo `'`**: ele fecha as aspas antes da hora e o comando dá erro.
   - O e-mail pode ir com maiúsculas ou minúsculas: o `lower(...)` compara tudo em minúsculas.

   Se aparecer uma linha com o seu e-mail, deu certo: entre no sistema com a nova senha.
   Se aparecer “No rows returned” (nenhuma linha), o e-mail digitado não bate com o do usuário: confira e rode de novo.
4. **Em seguida, apague essa consulta do SQL Editor**, porque ela guarda a senha escrita: na lista de consultas,
   à esquerda, encontre a que você acabou de rodar (o nome costuma ser “Untitled query”), abra o menu dela e
   escolha **“Delete”** (apagar).

**Passaram 7 dias sem usar e o sistema não abre (ou dá erro de conexão).**
O Supabase pausou o projeto para economizar espaço. Seus dados continuam guardados. Abra **https://supabase.com**,
entre no projeto `consultorio` e clique no botão para restaurá-lo (**“Restore project”**). Espere alguns minutos e
abra o sistema de novo. Para não acontecer, use o sistema ao menos uma vez por semana.

**Esqueci onde anotei o endereço do sistema.**
No Cloudflare, abra **Workers & Pages**, clique no projeto `consultorio`: o endereço `….pages.dev` aparece no alto da página.

---

## O que guardar, e o que nunca compartilhar

| Guarde com carinho | Para quê |
|---|---|
| Senha do banco (passo 1.2) | Chave-mestra do Supabase. **Nunca compartilhe.** O sistema não usa. |
| E-mail e senha do seu login (passo 1.4) | Para entrar no sistema. **Só você.** |
| Endereço `….pages.dev` (passo 2.2) | Onde o sistema abre. Pode abrir nos seus aparelhos. |
| Project URL e Publishable key (passo 1.6) | Já estão no Cloudflare. Guarde uma cópia para o caso de precisar reinstalar. |

**Nunca** envie, cole em sites ou coloque no Cloudflare: a **senha do banco** e a chave **secret / service_role**.

---

## Opcional — projeto de teste para os testes automáticos

Só faça isto se quiser rodar o teste que confere o sistema contra um banco de verdade. **Pode pular**: o sistema funciona
sem isto, e é um passo para quem mexe no código.

1. No Supabase, crie um **segundo projeto**, chamado `consultorio-teste`, também em **South America (São Paulo)**.
2. Nele, repita o passo 1.3 (rodar o texto de `supabase/migrations/20261023120000_base.sql`) e o passo 1.4
   (criar um usuário, que pode ter um e-mail e uma senha só para testes).
3. No computador, abra o terminal na pasta do projeto, exporte estas quatro variáveis com os dados **do projeto de teste**
   (Project URL, Publishable key, e-mail e senha do usuário de teste) e rode os testes:

   ```bash
   TEST_SUPABASE_URL=... TEST_SUPABASE_KEY=... TEST_SUPABASE_EMAIL=... TEST_SUPABASE_SENHA=... npm test
   ```

   Sem as quatro variáveis, esse teste aparece como “skipped” (pulado), e os demais rodam normalmente.

> **Muito cuidado:** o teste **apaga todos os dados** do usuário de teste a cada vez que roda.
> Use sempre um projeto **separado** do verdadeiro e **nunca** coloque aqui os dados do projeto `consultorio`.
