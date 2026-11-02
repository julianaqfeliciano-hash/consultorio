import { screen, waitFor, within } from '@testing-library/react';
import { abrirFicha, PEDRO, repositorioDemo, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

describe('SecaoAvaliacao', () => {
  it('mostra as etapas com as já feitas marcadas', async () => {
    abrirFicha(PEDRO);
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    expect(within(avaliacao).getAllByRole('checkbox')).toHaveLength(5);
    expect(within(avaliacao).getByLabelText('Entrevista com os responsáveis')).toBeChecked();
    expect(within(avaliacao).getByLabelText('Devolutiva')).not.toBeChecked();
  });

  it('marcar "Devolutiva" grava na hora; desmarcar também', async () => {
    const { repositorio, usuaria } = abrirFicha(PEDRO);
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    await usuaria.click(within(avaliacao).getByLabelText('Devolutiva'));

    await waitFor(async () => {
      const etapas = (await repositorio.obterFicha(PEDRO))?.avaliacao?.etapas;
      expect(etapas?.find((e) => e.nome === 'Devolutiva')?.feita).toBe(true);
    });
    expect(within(avaliacao).getByLabelText('Devolutiva')).toBeChecked();
    // As outras etapas ficam como estavam.
    expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.etapas.filter((e) => e.feita).map((e) => e.nome)).toEqual([
      'Entrevista com os responsáveis',
      'Devolutiva',
    ]);

    await usuaria.click(within(avaliacao).getByLabelText('Devolutiva'));
    await waitFor(async () => {
      const etapas = (await repositorio.obterFicha(PEDRO))?.avaliacao?.etapas;
      expect(etapas?.find((e) => e.nome === 'Devolutiva')?.feita).toBe(false);
    });
  });

  it('marcar duas etapas em seguida, com o repositório devagar, não perde nenhuma', async () => {
    const base = repositorioDemo();
    // Cada gravação demora: o segundo toque chega antes de a primeira terminar.
    const salvarAvaliacao: typeof base.salvarAvaliacao = async (a) => {
      await new Promise((resolver) => setTimeout(resolver, 40));
      return base.salvarAvaliacao(a);
    };
    const { repositorio, usuaria } = abrirFicha(PEDRO, { ...base, salvarAvaliacao });
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    await usuaria.click(within(avaliacao).getByLabelText('Testes aplicados'));
    await usuaria.click(within(avaliacao).getByLabelText('Contato com a escola'));

    await waitFor(async () => {
      const feitas = (await repositorio.obterFicha(PEDRO))?.avaliacao?.etapas.filter((e) => e.feita).map((e) => e.nome);
      expect(feitas).toEqual(['Entrevista com os responsáveis', 'Testes aplicados', 'Contato com a escola']);
    });
    expect(within(avaliacao).getByLabelText('Testes aplicados')).toBeChecked();
    expect(within(avaliacao).getByLabelText('Contato com a escola')).toBeChecked();
  });

  it('"Adicionar etapa" acrescenta uma etapa nova, desmarcada, e grava', async () => {
    const { repositorio, usuaria } = abrirFicha(PEDRO);
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    await usuaria.type(within(avaliacao).getByLabelText('Nova etapa'), '  Observação em sala de aula ');
    await usuaria.click(within(avaliacao).getByRole('button', { name: 'Adicionar etapa' }));

    const nova = await within(avaliacao).findByLabelText('Observação em sala de aula');
    expect(nova).not.toBeChecked();
    expect(within(avaliacao).getByLabelText('Nova etapa')).toHaveValue('');
    expect(within(avaliacao).getAllByRole('checkbox')).toHaveLength(6);
    const etapas = (await repositorio.obterFicha(PEDRO))?.avaliacao?.etapas;
    expect(etapas).toHaveLength(6);
    expect(etapas?.at(-1)).toEqual({ nome: 'Observação em sala de aula', feita: false });
  });

  it('etapa sem nome ou repetida é recusada', async () => {
    const { repositorio, usuaria } = abrirFicha(PEDRO);
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    await usuaria.click(within(avaliacao).getByRole('button', { name: 'Adicionar etapa' }));
    expect(await within(avaliacao).findByText('Informe o nome da etapa.')).toBeInTheDocument();

    await usuaria.type(within(avaliacao).getByLabelText('Nova etapa'), ' devolutiva ');
    await usuaria.click(within(avaliacao).getByRole('button', { name: 'Adicionar etapa' }));
    expect(await within(avaliacao).findByText('Essa etapa já existe.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.etapas).toHaveLength(5);
  });

  it('as sessões previstas podem ser mudadas e o cabeçalho acompanha', async () => {
    const { repositorio, usuaria } = abrirFicha(PEDRO);
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });
    expect(within(avaliacao).getByLabelText('Sessões previstas')).toHaveValue(10);

    await usuaria.clear(within(avaliacao).getByLabelText('Sessões previstas'));
    await usuaria.type(within(avaliacao).getByLabelText('Sessões previstas'), '12');
    await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar sessões previstas' }));

    expect(await screen.findByText('Avaliação · sessão 4 de 12')).toBeInTheDocument();
    expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.sessoesPrevistas).toBe(12);
  });

  it('sessões previstas precisa ser um número inteiro de 1 a 99', async () => {
    const { repositorio, usuaria } = abrirFicha(PEDRO);
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    for (const invalido of ['0', '100', '2.5']) {
      await usuaria.clear(within(avaliacao).getByLabelText('Sessões previstas'));
      await usuaria.type(within(avaliacao).getByLabelText('Sessões previstas'), invalido);
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar sessões previstas' }));
      expect(await within(avaliacao).findByText('Informe um número inteiro de 1 a 99.')).toBeInTheDocument();
    }
    expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.sessoesPrevistas).toBe(10);
  });

  it('se não conseguir gravar uma etapa, avisa e volta ao que estava', async () => {
    const base = repositorioDemo();
    const salvarAvaliacao = vi.fn().mockRejectedValue(new Error('sem rede'));
    const { usuaria } = abrirFicha(PEDRO, { ...base, salvarAvaliacao });
    const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });

    await usuaria.click(within(avaliacao).getByLabelText('Devolutiva'));

    expect(await within(avaliacao).findByRole('alert')).toHaveTextContent('Não foi possível salvar a avaliação. Tente de novo.');
    await waitFor(() => expect(within(avaliacao).getByLabelText('Devolutiva')).not.toBeChecked());
  });

  describe('valores do pacote', () => {
    async function abrirAvaliacao(repositorio = repositorioDemo()) {
      const aberta = abrirFicha(PEDRO, repositorio);
      const avaliacao = await screen.findByRole('region', { name: 'Avaliação' });
      return { ...aberta, avaliacao };
    }

    async function trocarValor(usuaria: ReturnType<typeof abrirFicha>['usuaria'], campo: HTMLElement, valor: string) {
      await usuaria.clear(campo);
      if (valor) await usuaria.type(campo, valor);
    }

    it('mostra o valor previsto, o desconto da semente e o valor final do Pedro: 1800 − 10% = R$ 1.620,00', async () => {
      const { avaliacao } = await abrirAvaliacao();

      expect(within(avaliacao).getByLabelText('Valor previsto')).toHaveValue('1800,00');
      const desconto = within(avaliacao).getByRole('group', { name: 'Desconto' });
      expect(within(desconto).getAllByRole('radio').map((r) => r.parentElement?.textContent)).toEqual([
        'Sem desconto',
        'Em reais',
        'Em porcentagem',
      ]);
      expect(within(desconto).getByLabelText('Em porcentagem')).toBeChecked();
      expect(within(avaliacao).getByLabelText('Valor do desconto')).toHaveValue(10);
      expect(within(avaliacao).getByText('Valor final: R$ 1.620,00')).toBeInTheDocument();
      expect(within(avaliacao).getByRole('button', { name: 'Salvar valores' })).toBeEnabled();
    });

    it('mudar para 15% mostra R$ 1.530,00 enquanto digita e, depois de salvar, persiste sem mexer no resto da avaliação', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao();
      const antes = (await repositorio.obterFicha(PEDRO))?.avaliacao;

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor do desconto'), '15');
      expect(within(avaliacao).getByText('Valor final: R$ 1.530,00')).toBeInTheDocument();
      // Ainda não gravou: só grava ao salvar.
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.descontoValor).toBe(10);

      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));

      expect(await within(avaliacao).findByText('Valores salvos.')).toBeInTheDocument();
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao).toEqual({
        ...antes,
        valorPrevistoCentavos: 180000,
        descontoTipo: 'percentual',
        descontoValor: 15,
      });
      expect(within(avaliacao).getByText('Valor final: R$ 1.530,00')).toBeInTheDocument();
    });

    it('o valor final acompanha o valor previsto e o tipo de desconto', async () => {
      const { avaliacao, usuaria } = await abrirAvaliacao();

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor previsto'), '2000');
      expect(within(avaliacao).getByText('Valor final: R$ 1.800,00')).toBeInTheDocument();

      await usuaria.click(within(avaliacao).getByLabelText('Em reais'));
      // O 10 da porcentagem não vira R$ 10: o campo do desconto começa vazio.
      expect(within(avaliacao).getByLabelText('Valor do desconto')).toHaveValue('');
      expect(within(avaliacao).getByText('Valor final: R$ 2.000,00')).toBeInTheDocument();
      await usuaria.type(within(avaliacao).getByLabelText('Valor do desconto'), '150,50');
      expect(within(avaliacao).getByText('Valor final: R$ 1.849,50')).toBeInTheDocument();

      await usuaria.click(within(avaliacao).getByLabelText('Sem desconto'));
      expect(within(avaliacao).queryByLabelText('Valor do desconto')).not.toBeInTheDocument();
      expect(within(avaliacao).getByText('Valor final: R$ 2.000,00')).toBeInTheDocument();
    });

    it('desconto em reais grava em centavos; sem desconto zera o valor do desconto', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao();

      await usuaria.click(within(avaliacao).getByLabelText('Em reais'));
      await usuaria.type(within(avaliacao).getByLabelText('Valor do desconto'), '150,50');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));
      await within(avaliacao).findByText('Valores salvos.');
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao).toMatchObject({
        valorPrevistoCentavos: 180000,
        descontoTipo: 'reais',
        descontoValor: 15050,
      });

      await usuaria.click(within(avaliacao).getByLabelText('Sem desconto'));
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));
      await waitFor(async () => {
        expect((await repositorio.obterFicha(PEDRO))?.avaliacao).toMatchObject({ descontoTipo: 'nenhum', descontoValor: 0 });
      });
    });

    it('depois de salvar, o valor previsto aparece como ficou gravado', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao();

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor previsto'), '1.950');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));

      await waitFor(() => expect(within(avaliacao).getByLabelText('Valor previsto')).toHaveValue('1950,00'));
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.valorPrevistoCentavos).toBe(195000);
    });

    it('120% mostra "Use uma porcentagem de 0 a 100." e não salva', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao();

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor do desconto'), '120');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));

      expect(await within(avaliacao).findByText('Use uma porcentagem de 0 a 100.')).toBeInTheDocument();
      const campo = within(avaliacao).getByLabelText('Valor do desconto');
      expect(campo).toBeInvalid();
      expect(campo).toHaveAccessibleDescription(expect.stringContaining('Use uma porcentagem de 0 a 100.'));
      expect(within(avaliacao).queryByText('Valores salvos.')).not.toBeInTheDocument();
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.descontoValor).toBe(10);
      // Sem um valor final que faça sentido, a linha não inventa um número.
      expect(within(avaliacao).queryByText(/Valor final: R\$/)).not.toBeInTheDocument();
      expect(within(avaliacao).getByText('Valor final: confira os valores.')).toBeInTheDocument();
    });

    it('desconto em reais de 2000 mostra "O desconto passa do valor previsto." e não salva', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao();

      await usuaria.click(within(avaliacao).getByLabelText('Em reais'));
      await usuaria.type(within(avaliacao).getByLabelText('Valor do desconto'), '2000');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));

      expect(await within(avaliacao).findByText('O desconto passa do valor previsto.')).toBeInTheDocument();
      expect(within(avaliacao).getByLabelText('Valor do desconto')).toBeInvalid();
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao).toMatchObject({ descontoTipo: 'percentual', descontoValor: 10 });
    });

    it('valor previsto inválido avisa e não salva; corrigir tira o aviso', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao();

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor previsto'), 'abc');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));
      expect(await within(avaliacao).findByText('Informe um valor válido, como 1800 ou 1800,50.')).toBeInTheDocument();
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.valorPrevistoCentavos).toBe(180000);

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor previsto'), '1700');
      expect(within(avaliacao).queryByText('Informe um valor válido, como 1800 ou 1800,50.')).not.toBeInTheDocument();
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));
      expect(await within(avaliacao).findByText('Valores salvos.')).toBeInTheDocument();
      expect((await repositorio.obterFicha(PEDRO))?.avaliacao?.valorPrevistoCentavos).toBe(170000);
    });

    it('o aviso de "salvos" some quando ela volta a editar', async () => {
      const { avaliacao, usuaria } = await abrirAvaliacao();
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));
      expect(await within(avaliacao).findByText('Valores salvos.')).toBeInTheDocument();

      await usuaria.type(within(avaliacao).getByLabelText('Valor do desconto'), '5');

      expect(within(avaliacao).queryByText('Valores salvos.')).not.toBeInTheDocument();
    });

    it('se não conseguir gravar, avisa e não diz que salvou', async () => {
      const base = repositorioDemo();
      const salvarAvaliacao = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { avaliacao, usuaria } = await abrirAvaliacao({ ...base, salvarAvaliacao });

      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));

      expect(await within(avaliacao).findByRole('alert')).toHaveTextContent('Não foi possível salvar a avaliação. Tente de novo.');
      expect(within(avaliacao).queryByText('Valores salvos.')).not.toBeInTheDocument();
    });

    // O repositório demora: o segundo toque chega antes de a primeira gravação terminar.
    function repositorioDevagar() {
      const base = repositorioDemo();
      const salvarAvaliacao: typeof base.salvarAvaliacao = async (a) => {
        await new Promise((resolver) => setTimeout(resolver, 120));
        return base.salvarAvaliacao(a);
      };
      return { ...base, salvarAvaliacao };
    }

    it('salvar os valores logo depois de marcar uma etapa não desfaz a etapa', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao(repositorioDevagar());

      await usuaria.click(within(avaliacao).getByLabelText('Testes aplicados'));
      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor do desconto'), '15');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));

      await waitFor(async () => {
        const gravada = (await repositorio.obterFicha(PEDRO))?.avaliacao;
        expect(gravada?.descontoValor).toBe(15);
        expect(gravada?.etapas.filter((e) => e.feita).map((e) => e.nome)).toEqual(['Entrevista com os responsáveis', 'Testes aplicados']);
      });
      expect(within(avaliacao).getByLabelText('Testes aplicados')).toBeChecked();
    });

    it('marcar uma etapa logo depois de salvar os valores não desfaz os valores', async () => {
      const { avaliacao, repositorio, usuaria } = await abrirAvaliacao(repositorioDevagar());

      await trocarValor(usuaria, within(avaliacao).getByLabelText('Valor do desconto'), '15');
      await usuaria.click(within(avaliacao).getByRole('button', { name: 'Salvar valores' }));
      await usuaria.click(within(avaliacao).getByLabelText('Testes aplicados'));

      await waitFor(async () => {
        const gravada = (await repositorio.obterFicha(PEDRO))?.avaliacao;
        expect(gravada?.descontoValor).toBe(15);
        expect(gravada?.etapas.filter((e) => e.feita).map((e) => e.nome)).toEqual(['Entrevista com os responsáveis', 'Testes aplicados']);
      });
    });
  });
});
