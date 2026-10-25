import { defineConfig, devices } from '@playwright/test';

/**
 * Teste de ponta a ponta do fluxo principal, no modo demonstração (sem banco de verdade), em dois tamanhos de
 * tela: o celular (390 px, um dia por vez na agenda) e o notebook (1280 px, a semana inteira em colunas).
 * Os dois usam o Chromium.
 *
 * O fuso do aparelho fica fixo em São Paulo nos dois, de propósito: o relógio de mentira do Playwright
 * (`page.clock`) troca `Date` por uma função que não deixa o `TZDate` da biblioteca de fusos (`@date-fns/tz`,
 * que estende `Date`) ser criado direito; com ele, qualquer fuso de aparelho diferente de São Paulo faz o
 * aplicativo contar o dia pelo aparelho. É um limite da ferramenta, não do aplicativo. A independência do fuso
 * do aparelho é provada em `fuso-do-aparelho.spec.ts` (aparelho em Tóquio, `Date` congelado sem `page.clock`)
 * e nos testes de unidade (o Vitest roda com TZ=Asia/Tokyo).
 */
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'celular',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'notebook',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    port: 5173,
    // Sempre um servidor novo e em modo demonstração: reaproveitar um `npm run dev` já aberto, que pode estar
    // ligado ao banco de verdade, gravaria a paciente do teste lá. As duas variáveis vazias têm precedência
    // sobre qualquer arquivo .env.local da máquina.
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});
