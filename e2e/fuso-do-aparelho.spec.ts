import { expect, test } from '@playwright/test';

/**
 * O consultório conta os dias no fuso de São Paulo, qualquer que seja o fuso do aparelho. Aqui o aparelho está em
 * Tóquio, onde já é terça de madrugada (03/11, 00:00) quando em São Paulo ainda é segunda ao meio-dia: o aplicativo
 * tem de continuar em segunda 02/11, com a sessão de terça (Ana Clara, 14:00) em "Amanhã".
 *
 * Este teste não usa `page.clock` (veja o comentário em `playwright.config.ts`): o relógio de mentira dele troca
 * `Date` por uma função que não deixa o `TZDate` (biblioteca de fusos) ser criado fora de São Paulo. Aqui o `Date`
 * continua o nativo, só embrulhado num Proxy que congela o "agora".
 */
test.use({ timezoneId: 'Asia/Tokyo' });

test('com o aparelho em Tóquio, hoje e amanhã seguem o dia de São Paulo', async ({ page }) => {
  await page.addInitScript(() => {
    const AGORA = Date.parse('2026-11-02T12:00:00-03:00');
    globalThis.Date = new Proxy(Date, {
      construct: (alvo, args, novoAlvo) => Reflect.construct(alvo, args.length === 0 ? [AGORA] : args, novoAlvo),
      get: (alvo, propriedade, receptor) => (propriedade === 'now' ? () => AGORA : Reflect.get(alvo, propriedade, receptor)),
    });
  });

  await page.goto('/');
  // Prova de que o aparelho está mesmo em outro dia: o relógio dele marca terça 03/11.
  expect(await page.evaluate(() => new Date().toLocaleDateString('pt-BR'))).toBe('03/11/2026');

  // Mas a agenda segue em segunda 02/11 ("Hoje"), e amanhã é a terça com a Ana Clara.
  await expect(page.getByText('02/11–08/11')).toBeVisible();
  await expect(page.getByRole('region', { name: 'segunda-feira, 02/11' }).getByText('Hoje', { exact: true })).toBeVisible();
  const aviso = page.getByRole('button', { name: 'Amanhã: 1 paciente' });
  await expect(aviso).toBeVisible();
  await aviso.click();
  await expect(page.getByRole('dialog')).toContainText('Ana Clara Souza');
});
