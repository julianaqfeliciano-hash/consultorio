import { render, screen } from '@testing-library/react';
import { RepositorioProvider, useRepositorio } from './contexto';
import { criarRepositorioMemoria } from './memoria';
import type { Repositorio } from './repositorio';

function Sonda({ esperado }: { esperado: Repositorio }) {
  return <p>{useRepositorio() === esperado ? 'repositório certo' : 'repositório errado'}</p>;
}

describe('RepositorioProvider', () => {
  it('entrega o repositório recebido aos componentes de dentro', () => {
    const repositorio = criarRepositorioMemoria();
    render(
      <RepositorioProvider repositorio={repositorio}>
        <Sonda esperado={repositorio} />
      </RepositorioProvider>,
    );
    expect(screen.getByText('repositório certo')).toBeInTheDocument();
  });

  it('o provedor mais de dentro vence (útil para testar uma tela com outro repositório)', () => {
    const externo = criarRepositorioMemoria();
    const interno = criarRepositorioMemoria();
    render(
      <RepositorioProvider repositorio={externo}>
        <RepositorioProvider repositorio={interno}>
          <Sonda esperado={interno} />
        </RepositorioProvider>
      </RepositorioProvider>,
    );
    expect(screen.getByText('repositório certo')).toBeInTheDocument();
  });

  it('useRepositorio fora do provedor avisa com um erro claro', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sonda esperado={criarRepositorioMemoria()} />)).toThrow(/RepositorioProvider/);
    erro.mockRestore();
  });
});
