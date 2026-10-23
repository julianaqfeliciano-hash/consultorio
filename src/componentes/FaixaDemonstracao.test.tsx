import { screen } from '@testing-library/react';
import { renderComRotas } from '../testes/utilitarios';

const AVISO = 'Modo demonstração — os dados são fictícios e não são salvos.';

describe('faixa do modo demonstração', () => {
  it.each(['/agenda', '/pacientes', '/financeiro', '/relatorios', '/mais'])('aparece em %s', async (caminho) => {
    renderComRotas(caminho, { modoDemonstracao: true });

    expect(await screen.findByText(AVISO)).toBeInTheDocument();
  });

  it('não aparece fora do modo demonstração', async () => {
    renderComRotas('/agenda');

    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});
