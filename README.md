# Consultório

Sistema de gestão do consultório de psicologia infantojuvenil: agenda, pacientes,
cobranças, registro das sessões, documentos e relatórios financeiros.
É um aplicativo web instalável (PWA) em React + TypeScript + Vite, com banco e login no Supabase.

Estado atual: **Etapas 1 e 2** (base e agenda): login, configurações, parceiros, pacientes e responsáveis,
horários fixos, agenda semanal, lista de amanhã com WhatsApp e bloqueios. A próxima é a Etapa 3, de cobrança.

## Documentos

- **[Guia de instalação](docs/instalacao.md)**: passo a passo, para quem não programa, de como colocar o sistema
  no ar (Supabase + Cloudflare) e instalá-lo no celular, no iPad e no notebook.
- [Desenho do sistema](docs/superpowers/specs/2026-10-21-sistema-consultorio-design.md): o que o sistema faz e por quê.
- [Plano das Etapas 1 e 2](docs/superpowers/plans/2026-10-23-etapas-1-e-2-base-e-agenda.md): como elas foram construídas.

## Como rodar

Precisa de [Node.js](https://nodejs.org) 22 (ou 20.19 ou mais novo).

```bash
npm install
npm run dev
```

Abra o endereço que o comando mostra (normalmente <http://localhost:5173>).

**Modo demonstração.** Sem as variáveis do Supabase, o aplicativo abre em modo demonstração: já entra logado, mostra uma
faixa amarela de aviso e usa dados fictícios (calculados a partir do dia de hoje) que ficam só na memória da página.
Nada é salvo; recarregar a página volta tudo ao começo.

**Com o banco de verdade.** Copie `.env.example` para `.env.local` e preencha as duas variáveis
(em *Project Settings → API*, no Supabase):

| Variável | O que é |
|---|---|
| `VITE_SUPABASE_URL` | o *Project URL* do projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | a *Publishable key* (nunca a chave *secret* / *service_role*) |

Com as duas preenchidas, o aplicativo pede login e usa o banco. A migração a aplicar no projeto novo está em
[`supabase/migrations/20261023120000_base.sql`](supabase/migrations/20261023120000_base.sql).

## Testes e verificação

| Comando | O que faz |
|---|---|
| `npm test` | Testes de unidade e de telas (Vitest). Rodam com o fuso do aparelho em Tóquio, para provar que nenhuma regra depende dele. O teste contra um Supabase de verdade só roda com as variáveis `TEST_SUPABASE_*` (veja `.env.example`); sem elas aparece como *skipped*. |
| `npm run e2e` | Teste de ponta a ponta (Playwright, Chromium) do fluxo principal no modo demonstração, em tamanho de celular e de notebook. Sobe o aplicativo sozinho na porta 5173 (ela precisa estar livre). Na primeira vez numa máquina, rode `npx playwright install chromium`. |
| `npm run typecheck` | Confere os tipos (TypeScript). |
| `npm run lint` | Confere o estilo do código (ESLint). |
| `npm run build` | Gera a versão de produção em `dist/`. |
| `npm run preview` | Abre a versão de produção para conferir antes de publicar. |

Antes de cada commit: `npm run typecheck && npm run lint && npm test`. Antes de uma entrega, também `npm run build && npm run e2e`.

## Pastas

- `src/regras/`: regras de negócio (datas, agenda, formulários), funções puras e testadas.
- `src/dados/`: acesso aos dados: repositório em memória (demonstração) e no Supabase, com os mesmos testes de contrato.
- `src/servicos/`: operações que combinam regras e dados (gerar a agenda, mudar um horário).
- `src/telas/` e `src/componentes/`: a interface.
- `supabase/`: a migração do banco e os testes das regras de acesso.
- `e2e/`: testes de ponta a ponta.
- `docs/`: guia de instalação, desenho e plano.
