import { render, screen } from '@testing-library/react';
import type { MesCobranca } from '../regras/cobranca';
import { ChipCobranca } from './ChipCobranca';

const ROTULOS: Record<MesCobranca['situacao'], string> = {
  pago: 'Pago',
  devendo: 'Devendo',
  em_andamento: 'Em andamento',
};

describe('ChipCobranca', () => {
  it.each(Object.entries(ROTULOS))('%s aparece com texto e com ícone', (situacao, rotulo) => {
    const { container } = render(<ChipCobranca situacao={situacao as MesCobranca['situacao']} />);

    expect(screen.getByText(rotulo)).toBeInTheDocument();
    const icone = container.querySelector('svg');
    expect(icone).not.toBeNull();
    // O ícone é enfeite: quem lê com leitor de tela ouve só o texto.
    expect(icone).toHaveAttribute('aria-hidden', 'true');
  });

  it('cada situação tem o seu ícone: a diferença não depende só de cor', () => {
    const icones = (Object.keys(ROTULOS) as MesCobranca['situacao'][]).map((situacao) => {
      const { container, unmount } = render(<ChipCobranca situacao={situacao} />);
      const desenho = container.querySelector('svg')?.innerHTML;
      unmount();
      return desenho;
    });

    expect(new Set(icones).size).toBe(3);
  });
});
