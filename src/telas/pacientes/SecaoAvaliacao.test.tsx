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
});
