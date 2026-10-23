import { screen, within } from '@testing-library/react';
import { abrirFicha, MARIA, PEDRO, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

describe('SecaoCobranca', () => {
  it('mostra a forma e o valor gravados', async () => {
    abrirFicha(MARIA);
    const cobranca = await screen.findByRole('region', { name: 'Cobrança' });

    expect(within(cobranca).getByLabelText('Por sessão')).toBeChecked();
    expect(within(cobranca).getByLabelText('Por mês')).not.toBeChecked();
    expect(within(cobranca).getByLabelText('Valor da sessão')).toHaveValue('180,00');
    expect(within(cobranca).getByText(/R\$\s180,00/)).toBeInTheDocument();
  });

  it('escolher "Por mês" com valor "200" salva 20000 centavos e mostra "R$ 200,00"', async () => {
    const { repositorio, usuaria } = abrirFicha(MARIA);
    const cobranca = await screen.findByRole('region', { name: 'Cobrança' });

    await usuaria.click(within(cobranca).getByLabelText('Por mês'));
    await usuaria.clear(within(cobranca).getByLabelText('Valor da sessão'));
    await usuaria.type(within(cobranca).getByLabelText('Valor da sessão'), '200');
    await usuaria.click(within(cobranca).getByRole('button', { name: 'Salvar cobrança' }));

    expect(await within(cobranca).findByText('Cobrança salva.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(MARIA))?.paciente).toMatchObject({ formaCobranca: 'mensal', valorSessaoCentavos: 20000 });
    // O campo passa a mostrar o valor como ficou gravado.
    expect(within(cobranca).getByLabelText('Valor da sessão')).toHaveValue('200,00');
    expect(within(cobranca).getByText(/R\$\s200,00/)).toBeInTheDocument();
    expect(within(cobranca).queryByText(/R\$\s180,00/)).not.toBeInTheDocument();
  });

  it('aceita o formato brasileiro: 1.250,50', async () => {
    const { repositorio, usuaria } = abrirFicha(MARIA);
    const cobranca = await screen.findByRole('region', { name: 'Cobrança' });

    await usuaria.clear(within(cobranca).getByLabelText('Valor da sessão'));
    await usuaria.type(within(cobranca).getByLabelText('Valor da sessão'), 'R$ 1.250,50');
    await usuaria.click(within(cobranca).getByRole('button', { name: 'Salvar cobrança' }));

    await within(cobranca).findByText('Cobrança salva.');
    expect((await repositorio.obterFicha(MARIA))?.paciente.valorSessaoCentavos).toBe(125050);
  });

  it('valor que não é número é recusado, com aviso', async () => {
    const { repositorio, usuaria } = abrirFicha(MARIA);
    const cobranca = await screen.findByRole('region', { name: 'Cobrança' });

    await usuaria.clear(within(cobranca).getByLabelText('Valor da sessão'));
    await usuaria.type(within(cobranca).getByLabelText('Valor da sessão'), 'abc');
    await usuaria.click(within(cobranca).getByRole('button', { name: 'Salvar cobrança' }));

    expect(await within(cobranca).findByText('Informe um valor válido, como 180 ou 180,50.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(MARIA))?.paciente.valorSessaoCentavos).toBe(18000);
  });

  it('para quem está em avaliação, explica que a avaliação é cobrada como pacote', async () => {
    abrirFicha(PEDRO);
    const cobranca = await screen.findByRole('region', { name: 'Cobrança' });

    expect(within(cobranca).getByText(/pacote/)).toBeInTheDocument();
  });
});
