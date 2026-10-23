import { screen } from '@testing-library/react';
import { renderComRotas } from '../testes/utilitarios';

describe('Layout', () => {
  it('mostra as 5 abas na ordem do spec', () => {
    renderComRotas('/agenda');
    const abas = screen.getAllByRole('link', {
      name: /agenda|pacientes|financeiro|relatórios|mais/i,
    });
    expect(abas.map((a) => a.textContent)).toEqual([
      'Agenda',
      'Pacientes',
      'Financeiro',
      'Relatórios',
      'Mais',
    ]);
  });

  it('marca a aba atual com aria-current', () => {
    renderComRotas('/pacientes');
    expect(screen.getByRole('link', { name: 'Pacientes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('mostra a logo com o nome', () => {
    renderComRotas('/agenda');
    expect(screen.getByText('Juliana Feliciano')).toBeInTheDocument();
  });

  it('Financeiro mostra "Em construção"', () => {
    renderComRotas('/financeiro');
    expect(screen.getByText(/em construção/i)).toBeInTheDocument();
  });
});
