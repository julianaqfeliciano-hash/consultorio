import { expect, test, type Page } from '@playwright/test';

/**
 * A cobrança, do jeito que a psicóloga usa, no modo demonstração (dados fictícios só na memória):
 * ver quem está devendo, registrar o mês de outubro da Ana Clara pela ficha, conferir o pagamento no
 * Financeiro e registrar o pagamento de uma sessão da Maria Luísa direto na agenda.
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

test('registra o mês da Ana Clara pela ficha e a sessão da Maria Luísa pela agenda', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.clock.setFixedTime(AGORA);
  const menu = page.getByRole('navigation', { name: 'Principal' });

  await test.step('Financeiro: "A receber" lista Ana, Pedro e Maria', async () => {
    await page.goto('/');
    await menu.getByRole('link', { name: 'Financeiro' }).click();

    const aReceber = page.getByRole('region', { name: 'A receber' });
    await expect(aReceber).toContainText('Total a receber');
    const itens = aReceber.getByRole('listitem');
    await expect(itens).toHaveCount(3);
    await expect(itens.nth(0)).toContainText('Ana Clara Souza');
    await expect(itens.nth(0)).toContainText('800,00');
    await expect(itens.nth(1)).toContainText('Pedro Henrique Lima');
    await expect(itens.nth(1)).toContainText('810,00');
    await expect(itens.nth(2)).toContainText('Maria Luísa Costa');
    await expect(itens.nth(2)).toContainText('180,00');
  });

  await test.step('na ficha da Ana, registra o pagamento de outubro', async () => {
    await page.getByRole('region', { name: 'A receber' }).getByRole('link', { name: /Ana Clara Souza/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ana Clara Souza' })).toBeVisible();

    const financeiro = page.getByRole('region', { name: 'Financeiro' });
    const outubro = financeiro.getByRole('listitem').filter({ hasText: /outubro/i }).filter({ hasText: 'Devendo' });
    await expect(outubro).toHaveCount(1);
    await outubro.getByRole('button', { name: 'Registrar pagamento do mês' }).click();

    const formulario = financeiro.getByRole('form', { name: /Pagamento de outubro/i });
    await formulario.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(formulario).toBeHidden();
    await expect(financeiro.getByRole('listitem').filter({ hasText: /outubro/i }).filter({ hasText: 'Devendo' })).toHaveCount(0);
  });

  await test.step('de volta ao Financeiro, a Ana saiu da lista e o pagamento aparece em novembro', async () => {
    await menu.getByRole('link', { name: 'Financeiro' }).click();

    const aReceber = page.getByRole('region', { name: 'A receber' });
    await expect(aReceber.getByRole('listitem')).toHaveCount(2);
    await expect(aReceber).not.toContainText('Ana Clara Souza');
    await expect(aReceber).toContainText('Pedro Henrique Lima');
    await expect(aReceber).toContainText('Maria Luísa Costa');

    const pagamentos = page.getByRole('region', { name: 'Pagamentos' });
    await expect(pagamentos).toContainText('02/11');
    await expect(pagamentos).toContainText('Ana Clara Souza');
    await expect(pagamentos).toContainText('800,00');
  });

  await test.step('na agenda, registra o pagamento da sessão da Maria', async () => {
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

    const painel = page.getByRole('dialog', { name: 'Maria Luísa Costa' });
    await expect(painel).toContainText('Pendente · R$');
    await expect(painel).toContainText('180,00');
    await painel.getByRole('button', { name: 'Registrar pagamento' }).click();
    await painel.getByRole('form', { name: 'Registrar pagamento' }).getByRole('button', { name: 'Confirmar pagamento' }).click();

    await expect(painel).toContainText('Pago em 02/11 · Pix');
    await expect(painel).not.toContainText('Pendente');
  });

  expect(erros, 'o navegador não deve acusar nenhum erro').toEqual([]);
});
