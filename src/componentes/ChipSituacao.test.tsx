import { render, screen } from '@testing-library/react';
import { ChipSituacao } from './ChipSituacao';
import type { SituacaoSessao } from '../dominio/tipos';

const ROTULOS: Record<SituacaoSessao, string> = {
  agendada: 'Agendada',
  compareceu: 'Compareceu',
  falta_com_aviso: 'Faltou com aviso',
  falta_sem_aviso: 'Faltou sem aviso',
  cancelada: 'Cancelada',
  remarcada: 'Remarcada',
};

describe('ChipSituacao', () => {
  it.each(Object.entries(ROTULOS))('%s aparece com texto e com ícone', (situacao, rotulo) => {
    const { container } = render(<ChipSituacao situacao={situacao as SituacaoSessao} />);

    expect(screen.getByText(rotulo)).toBeInTheDocument();
    const icone = container.querySelector('svg');
    expect(icone).not.toBeNull();
    // O ícone é enfeite: quem lê com leitor de tela ouve só o texto.
    expect(icone).toHaveAttribute('aria-hidden', 'true');
  });
});
