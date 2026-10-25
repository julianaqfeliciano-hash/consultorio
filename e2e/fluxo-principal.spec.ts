import { expect, test, type Page } from '@playwright/test';

/**
 * O fluxo principal, do jeito que a psicóloga usa, no modo demonstração (dados fictícios só na memória):
 * ver o aviso de amanhã, cadastrar uma paciente com responsável e horário fixo, achar a sessão dela na
 * semana seguinte e marcar que compareceu.
 *
 * Os dados do modo demonstração vivem só na memória da página: depois do primeiro `goto`, tudo é feito
 * clicando (recarregar a página traria os dados de volta ao começo).
 */

/** Segunda-feira, 02/11/2026, meio-dia em São Paulo. */
const AGORA = new Date('2026-11-02T12:00:00-03:00');

/** Registra tudo que o navegador acusa como erro: mensagens de `console.error` e exceções não tratadas. */
function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on('console', (mensagem) => {
    if (mensagem.type() === 'error') erros.push(mensagem.text());
  });
  page.on('pageerror', (erro) => erros.push(erro.message));
  return erros;
}

test('cadastra uma paciente, vê a sessão dela na agenda e marca que compareceu', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.clock.setFixedTime(AGORA);
  const menu = page.getByRole('navigation', { name: 'Principal' });

  await test.step('abre o aplicativo: faixa de demonstração e aviso de amanhã', async () => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/agenda$/);
    await expect(page.getByText('Modo demonstração — os dados são fictícios e não são salvos.')).toBeVisible();
    // Hoje é segunda 02/11: amanhã é terça, com a Ana Clara às 14:00.
    await expect(page.getByText('Hoje', { exact: true })).toBeVisible();
    const aviso = page.getByRole('button', { name: 'Amanhã: 1 paciente' });
    await expect(aviso).toBeVisible();

    await aviso.click();
    const lista = page.getByRole('dialog');
    await expect(lista).toContainText('Ana Clara Souza');
    await expect(lista).toContainText('14:00');
    await lista.getByRole('button', { name: 'Fechar' }).click();
    await expect(lista).toBeHidden();
  });

  await test.step('cadastra a paciente Beatriz Teste', async () => {
    await menu.getByRole('link', { name: 'Pacientes' }).click();
    await page.getByRole('link', { name: 'Novo paciente' }).click();

    await page.getByLabel('Nome', { exact: true }).fill('Beatriz Teste');
    await page.getByRole('radio', { name: 'Psicoterapia' }).check();
    await page.getByRole('radio', { name: 'Por sessão' }).check();
    await page.getByLabel('Valor da sessão').fill('150');
    await page.getByRole('button', { name: 'Salvar paciente' }).click();

    // Salvando, abre a ficha da paciente.
    await expect(page.getByRole('heading', { level: 1, name: 'Beatriz Teste' })).toBeVisible();
    // A seção "Cobrança" começa fechada no celular: basta o texto estar na página.
    await expect(page.getByText(/Hoje: por sessão,\s*R\$\s*150,00 a sessão\./)).toBeAttached();
  });

  await test.step('acrescenta o responsável Carla (principal) na ficha', async () => {
    const responsaveis = page.getByRole('region', { name: 'Responsáveis' });
    await responsaveis.getByRole('button', { name: 'Adicionar responsável' }).click();
    await responsaveis.getByLabel('Nome', { exact: true }).fill('Carla');
    await responsaveis.getByLabel('Parentesco').fill('Mãe');
    await responsaveis.getByLabel('Telefone').fill('(85) 90000-0009');
    // O primeiro responsável de uma ficha já nasce como principal e pagador.
    await expect(responsaveis.getByLabel('Responsável principal')).toBeChecked();
    await responsaveis.getByRole('button', { name: 'Salvar responsável' }).click();

    await expect(responsaveis).toContainText('Carla');
    await expect(responsaveis).toContainText('Principal');
    await expect(responsaveis).toContainText('(85) 90000-0009');
  });

  await test.step('acrescenta o horário fixo de segunda às 10:00', async () => {
    const horarios = page.getByRole('region', { name: 'Horários fixos' });
    await horarios.getByRole('button', { name: 'Adicionar horário' }).click();
    await horarios.getByLabel('Dia da semana').selectOption({ label: 'Segunda' });
    await horarios.getByLabel('Hora', { exact: true }).fill('10:00');
    await horarios.getByRole('button', { name: 'Salvar horário' }).click();

    await expect(horarios).toContainText('Segunda, 10:00, 50 min');
  });

  await test.step('na agenda, a sessão aparece na segunda 09/11', async () => {
    await menu.getByRole('link', { name: 'Agenda' }).click();
    await page.getByRole('button', { name: 'Próxima semana' }).click();

    await expect(page.getByText('09/11–15/11')).toBeVisible();
    // No celular a agenda mostra o dia em foco (a segunda, já que a troca de semana mantém o dia); no notebook, a semana toda.
    await expect(page.getByRole('heading', { level: 2, name: /segunda/i })).toBeVisible();
    await expect(sessaoDaBeatriz(page)).toHaveCount(1);
    await expect(sessaoDaBeatriz(page)).toContainText('10:00');
  });

  await test.step('marca que a Beatriz compareceu', async () => {
    await sessaoDaBeatriz(page).click();

    const painel = page.getByRole('dialog', { name: 'Beatriz Teste' });
    await expect(painel).toBeVisible();
    await painel.getByRole('button', { name: 'Compareceu' }).click();
    await expect(painel.getByRole('button', { name: 'Compareceu', pressed: true })).toBeVisible();

    await painel.getByRole('button', { name: 'Fechar' }).click();
    await expect(painel).toBeHidden();
    // O cartão na agenda mostra a situação em texto (o chip "Compareceu").
    await expect(sessaoDaBeatriz(page)).toContainText('Compareceu');
    await expect(sessaoDaBeatriz(page)).not.toContainText('Agendada');
  });

  expect(erros, 'o navegador não deve acusar nenhum erro').toEqual([]);
});

/** O cartão da sessão da Beatriz na agenda (o botão que abre o painel da sessão). */
function sessaoDaBeatriz(page: Page) {
  return page.getByRole('main').getByRole('button', { name: /Beatriz Teste/ });
}
