import { expect, test, type Page } from '@playwright/test';

/**
 * O registro com o Claude, do jeito que a psicóloga usa, no modo demonstração (dados fictícios só na
 * memória, resumo de mentira): escrever o que aconteceu, resumir, salvar e ver o registro na agenda.
 *
 * Depois do primeiro `goto`, tudo é feito clicando (recarregar a página devolveria os dados ao começo).
 */

/** Segunda-feira, 02/11/2026, meio-dia em São Paulo. */
const AGORA = new Date('2026-11-02T12:00:00-03:00');

function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on('console', (mensagem) => {
    if (mensagem.type() === 'error') erros.push(mensagem.text());
  });
  page.on('pageerror', (erro) => erros.push(erro.message));
  return erros;
}

test('escreve, resume e salva o registro da sessão da Maria Luísa', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.clock.setFixedTime(AGORA);
  const menu = page.getByRole('navigation', { name: 'Principal' });

  async function abrirSessao() {
    await menu.getByRole('link', { name: 'Agenda' }).click();
    await page.getByRole('button', { name: 'Semana anterior' }).click();
    // No celular a agenda mostra um dia por vez: vai até a quinta 29/10.
    const sessao = page.getByRole('main').getByRole('button', { name: /Maria Luísa Costa/ });
    const quinta = page.getByRole('button', { name: /Qui 29/ });
    await expect(sessao.or(quinta).first()).toBeVisible();
    if ((await sessao.count()) === 0) {
      await quinta.click();
    }
    await expect(sessao).toHaveCount(1);
    await sessao.click();
    return page.getByRole('dialog', { name: 'Maria Luísa Costa' });
  }

  await test.step('abre a sessão de 29/10, marca "Compareceu" e vai para o registro', async () => {
    await page.goto('/');
    const painel = await abrirSessao();
    await painel.getByRole('button', { name: 'Compareceu' }).click();
    await painel.getByRole('link', { name: 'Escrever registro' }).click();
    await expect(page).toHaveURL(/\/agenda\/sessoes\/.+\/registro$/);
  });

  await test.step('escreve o texto, resume e confere os quatro campos', async () => {
    await page.getByLabel('O que aconteceu na sessão').fill('Maria chegou animada e brincou de casinha com a mãe.');
    await page.getByRole('button', { name: 'Resumir' }).click();

    for (const rotulo of ['Como chegou', 'O que foi trabalhado', 'Observações', 'Próximos passos']) {
      await expect(page.getByLabel(rotulo, { exact: true })).toHaveValue(/\(demonstração\)/);
    }
  });

  await test.step('salva o registro', async () => {
    await page.getByRole('button', { name: 'Salvar registro' }).click();
    await expect(page.getByText('Registro salvo.')).toBeVisible();
  });

  await test.step('de volta à agenda, o painel da sessão mostra "Ver registro"', async () => {
    const painel = await abrirSessao();
    await expect(painel.getByRole('link', { name: 'Ver registro' })).toBeVisible();
  });

  expect(erros, 'o navegador não deve acusar nenhum erro').toEqual([]);
});
