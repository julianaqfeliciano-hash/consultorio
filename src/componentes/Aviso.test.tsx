import { render, screen } from '@testing-library/react';
import { Aviso } from './Aviso';

describe('Aviso', () => {
  it('erro interrompe a leitura (role="alert")', () => {
    render(<Aviso tipo="erro">Não foi possível salvar.</Aviso>);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.');
  });

  it('sucesso só informa (role="status")', () => {
    render(<Aviso tipo="sucesso">Cobrança salva.</Aviso>);
    expect(screen.getByRole('status')).toHaveTextContent('Cobrança salva.');
  });

  it('atenção chama a atenção sem interromper a leitura (role="status", não "alert")', () => {
    render(<Aviso tipo="atencao">Falta receber: R$ 200,00.</Aviso>);
    expect(screen.getByRole('status')).toHaveTextContent('Falta receber: R$ 200,00.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Sempre com ícone e texto, nunca só cor.
    expect(screen.getByRole('status').querySelector('svg')).not.toBeNull();
  });
});
